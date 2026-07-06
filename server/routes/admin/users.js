const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { createNotification } = require('../../utils/notifications');

function cleanText(value, maxLength = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPositiveInt(value, fallback, max = 1000) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(max, Math.floor(n));
}

function toSuspendDays(value) {
    return Math.max(1, Math.min(365, toPositiveInt(value, 7, 365)));
}

function isSuspensionActive(user) {
    if (user?.moderationStatus !== 'suspended') return false;
    if (!user?.suspendedUntil) return true;
    return new Date(user.suspendedUntil).getTime() > Date.now();
}

function serializeAdminUser(user) {
    const stats = user?.statistics || {};
    return {
        _id: String(user?._id || ''),
        username: user?.username || '',
        nickname: user?.nickname || '',
        lp: Number(user?.lp || 0),
        credits: Number(user?.credits || 0),
        statistics: {
            totalGames: Number(stats.totalGames || 0),
            totalKills: Number(stats.totalKills || 0),
            totalWins: Number(stats.totalWins || 0),
        },
        isAdmin: Boolean(user?.isAdmin),
        moderationStatus: user?.moderationStatus || 'active',
        moderationReason: user?.moderationReason || '',
        suspendedUntil: user?.suspendedUntil || null,
        suspensionActive: isSuspensionActive(user),
        moderatedAt: user?.moderatedAt || null,
        deactivatedAt: user?.deactivatedAt || null,
        createdAt: user?.createdAt || null,
    };
}

router.get('/users', async (req, res) => {
    try {
        const q = cleanText(req.query?.q, 80);
        const status = cleanText(req.query?.status, 20);
        const limit = toPositiveInt(req.query?.limit, 50, 100);
        const page = toPositiveInt(req.query?.page, 1, 100000);
        const filter = {};

        if (q) {
            const pattern = new RegExp(escapeRegExp(q), 'i');
            filter.$or = [{ username: pattern }, { nickname: pattern }];
        }
        if (status === 'suspended') filter.moderationStatus = 'suspended';
        if (status === 'deactivated') filter.moderationStatus = 'deactivated';
        if (status === 'active') {
            filter.$and = [
                ...(Array.isArray(filter.$and) ? filter.$and : []),
                { $or: [{ moderationStatus: { $exists: false } }, { moderationStatus: 'active' }] },
            ];
        }
        if (status === 'admin') filter.isAdmin = true;

        const [total, users, summary] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter)
                .select('username nickname lp credits statistics isAdmin moderationStatus moderationReason suspendedUntil moderatedAt deactivatedAt createdAt')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Promise.all([
                User.countDocuments({}),
                User.countDocuments({ isAdmin: true }),
                User.countDocuments({ moderationStatus: 'suspended' }),
                User.countDocuments({ moderationStatus: 'deactivated' }),
            ]),
        ]);

        res.json({
            users: users.map(serializeAdminUser),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            summary: {
                total: Number(summary[0] || 0),
                admins: Number(summary[1] || 0),
                suspended: Number(summary[2] || 0),
                deactivated: Number(summary[3] || 0),
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message || '유저 목록을 불러오지 못했습니다.' });
    }
});

router.post('/users/:id/suspend', async (req, res) => {
    try {
        const targetId = String(req.params.id || '');
        if (!targetId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: '잘못된 유저 ID입니다.' });
        }
        if (String(req.user.id) === targetId) {
            return res.status(400).json({ error: '자기 계정은 정지할 수 없습니다.' });
        }

        const target = await User.findById(targetId).select('username nickname isAdmin moderationStatus');
        if (!target) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
        if (target.isAdmin) return res.status(400).json({ error: '관리자 계정은 정지할 수 없습니다.' });
        if (target.moderationStatus === 'deactivated') {
            return res.status(400).json({ error: '탈퇴한 계정은 정지 처리할 수 없습니다.' });
        }

        const days = toSuspendDays(req.body?.days);
        const reason = cleanText(req.body?.reason || '운영 정책 위반으로 계정이 정지되었습니다.', 500);
        const now = new Date();
        const suspendedUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        const updated = await User.findByIdAndUpdate(
            targetId,
            {
                $set: {
                    moderationStatus: 'suspended',
                    moderationReason: reason,
                    suspendedUntil,
                    moderatedBy: req.user.id,
                    moderatedAt: now,
                },
            },
            { new: true }
        ).select('username nickname lp credits statistics isAdmin moderationStatus moderationReason suspendedUntil moderatedAt deactivatedAt createdAt').lean();

        await createNotification({
            userId: targetId,
            type: 'system',
            title: '계정 정지 안내',
            message: `${days}일 동안 계정 이용이 제한됩니다. 사유: ${reason}`,
            link: '/account',
            meta: { moderationStatus: 'suspended', days, reason },
        });

        res.json({ message: `${target.nickname || target.username} 계정을 ${days}일 정지했습니다.`, user: serializeAdminUser(updated) });
    } catch (err) {
        res.status(500).json({ error: err.message || '계정 정지에 실패했습니다.' });
    }
});

router.post('/users/:id/unsuspend', async (req, res) => {
    try {
        const targetId = String(req.params.id || '');
        if (!targetId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ error: '잘못된 유저 ID입니다.' });
        }

        const target = await User.findById(targetId).select('username nickname');
        if (!target) return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });

        const updated = await User.findByIdAndUpdate(
            targetId,
            {
                $set: {
                    moderationStatus: 'active',
                    moderationReason: '',
                    suspendedUntil: null,
                    moderatedBy: req.user.id,
                    moderatedAt: new Date(),
                },
            },
            { new: true }
        ).select('username nickname lp credits statistics isAdmin moderationStatus moderationReason suspendedUntil moderatedAt deactivatedAt createdAt').lean();

        await createNotification({
            userId: targetId,
            type: 'system',
            title: '계정 정지 해제',
            message: '계정 이용 제한이 해제되었습니다.',
            link: '/account',
            meta: { moderationStatus: 'active' },
        });

        res.json({ message: `${target.nickname || target.username} 계정 정지를 해제했습니다.`, user: serializeAdminUser(updated) });
    } catch (err) {
        res.status(500).json({ error: err.message || '계정 정지 해제에 실패했습니다.' });
    }
});


// 1. 모든 유저 LP 초기화 (시즌 초기화)
router.post('/reset-lp', async (req, res) => {
    try {
        await User.updateMany({}, { lp: 0 });
        console.log(`[Admin] ${req.user.username}님이 시즌을 초기화했습니다.`);
        res.json({ message: "모든 유저의 LP가 0으로 초기화되었습니다." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. 특정 유저에게 LP 선물하기 (이벤트)
router.post('/give-lp', async (req, res) => {
    const { username, amount } = req.body;
    try {
        const user = await User.findOneAndUpdate(
            { username }, 
            { $inc: { lp: amount } },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
        }

        console.log(`[Admin] ${username}님에게 ${amount} LP 지급`);
        res.json({ message: `${username}님에게 ${amount} LP 지급 완료!`, currentLp: user.lp });
    } catch (err) {
        res.status(500).json({ error: "서버 오류" });
    }
});

// 1. 새 아이템 생성
// 모든 아이템 목록 가져오기 (관리용)

module.exports = router;
