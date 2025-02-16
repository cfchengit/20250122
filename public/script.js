document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const fileList = document.getElementById('fileList');
  const studentId = document.getElementById('studentId');

  // 載入已上傳的檔案列表
  fetchFileList();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      alert('檔案上傳成功！');
      
      // 顯示學生作品頁面的連結
      fileList.innerHTML = `
        <h2>上傳成功！</h2>
        <p>您可以在以下網址查看您的作品：</p>
        <a href="${data.studentUrl}" target="_blank">點擊查看作品頁面</a>
      `;
      
      form.reset();
    } catch (error) {
      alert('上傳失敗：' + error.message);
    }
  });

  async function fetchFileList() {
    try {
      const response = await fetch('/files');
      const files = await response.json();
      fileList.innerHTML = '<h2>已上傳的檔案：</h2>';
      files.forEach(file => {
        fileList.innerHTML += `
          <div class="file-item">
            <a href="/uploads/${file}" target="_blank">${file}</a>
          </div>
        `;
      });
    } catch (error) {
      console.error('獲取檔案列表失敗：', error);
    }
  }
}); 