import dotenv from 'dotenv';

// 테스트용 환경 변수 로드
dotenv.config({ path: '.env.test' });

// 테스트 타임아웃 설정
jest.setTimeout(30000);

// 로그 레벨을 error로 설정하여 테스트 출력을 깔끔하게 유지
process.env.LOG_LEVEL = 'error';

