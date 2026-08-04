// ★テスト環境の設定（本番とは別のGAS Webアプリ＝別スプレッドシートを指す）
// TEST_GAS_URL をテスト用WebアプリのexecURLに差し替えてください。
// 未設定のうちはAPIに接続できません（本番データを触らない安全側の初期値）。
window.APP_CONFIG = {
  API_URL: 'TEST_GAS_URL',   // 例: https://script.google.com/macros/s/XXXX.../exec
  VERSION: 'test',
  TEST_ENV: true             // 画面上部に「TEST」表示を出す
};
