// server/check_models.js
require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.GOOGLE_API_KEY;

async function getAvailableModels() {
  if (!API_KEY) {
    console.error("❌ .env 파일에서 GOOGLE_API_KEY를 찾을 수 없습니다.");
    return;
  }

  console.log(`🔎 내 키(${API_KEY.substring(0, 5)}...)로 사용 가능한 모델을 조회합니다...\n`);

  try {
    // 구글 API에 직접 요청
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const response = await axios.get(url);
    
    console.log("✅ [사용 가능 모델 목록]");
    console.log("------------------------------------------------");
    
    let found = false;
    response.data.models.forEach(model => {
      // 'generateContent' 기능이 있는 모델만 출력 (채팅용)
      if (model.supportedGenerationMethods.includes("generateContent")) {
        // "models/gemini-pro" -> "gemini-pro" 로만 출력
        const cleanName = model.name.replace("models/", "");
        console.log(`👉 "${cleanName}"`);
        found = true;
      }
    });

    if (!found) {
        console.log("⚠️ 사용 가능한 모델이 없습니다. 구글 클라우드 콘솔에서 API가 활성화되었는지 확인하세요.");
    }
    console.log("------------------------------------------------");
    console.log("💡 위 목록 중 하나를 골라 server/index.js의 model: '...' 부분에 넣으세요.");

  } catch (error) {
    console.error("\n❌ 조회 실패!");
    if (error.response) {
        console.error(`에러 코드: ${error.response.status} (${error.response.statusText})`);
        console.error(`에러 내용:`, error.response.data);
    } else {
        console.error(error.message);
    }
  }
}

getAvailableModels();