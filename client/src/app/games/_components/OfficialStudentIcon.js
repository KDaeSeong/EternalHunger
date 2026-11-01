import Image from 'next/image';

const STUDENT_IDS = new Set(['serika', 'ayane', 'nonomi', 'shiroko', 'hoshino', 'haruka', 'mutsuki', 'iori', 'ako', 'hina', 'yuuka', 'momoi', 'midori', 'noa', 'aris', 'hanako', 'koharu', 'azusa', 'tsurugi', 'mika', 'yuzu']);

// Local, bounded portraits from official game artwork. Provenance lives beside the assets.
export default function OfficialStudentIcon({ id, className = '' }) {
  if (!STUDENT_IDS.has(id)) return null;
  return <Image src={'/games/shared/blue-archive/' + id + '.webp'} width={160} height={160} alt="" aria-hidden="true"
    className={'official-student-icon ' + className} unoptimized draggable={false}
    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />;
}
