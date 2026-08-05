// ★テスト環境の設定（本番とは別のGAS Webアプリ＝別スプレッドシートを指す）
// TEST_GAS_URL をテスト用WebアプリのexecURLに差し替えてください。
// 未設定のうちはAPIに接続できません（本番データを触らない安全側の初期値）。
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwUB5XFbVV7CxUtG8_Guy5VMl1SATuye1Y265cu_JlNAdBsV2wpKmRO8labkeqLzEE/exec',
  VERSION: 'test',
  TEST_ENV: true             // 画面上部に「TEST」表示を出す
};
