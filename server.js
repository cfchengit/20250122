const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const app = express();

// 設定檔案存儲
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 從請求中獲取學號和週次
    const studentId = req.body.studentId;
    const week = req.body.week;
    
    // 創建以學號和週次為名的目錄路徑
    const studentDir = path.join('uploads', studentId);
    const weekDir = path.join(studentDir, `week${week}`);
    
    // 如果目錄不存在，創建它們
    if (!fs.existsSync(studentDir)){
      fs.mkdirSync(studentDir, { recursive: true });
    }
    if (!fs.existsSync(weekDir)){
      fs.mkdirSync(weekDir, { recursive: true });
    }
    
    cb(null, weekDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

// 檔案過濾器
const fileFilter = (req, file, cb) => {
  // 允許的檔案類型
  const allowedTypes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'multipart/x-zip'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, true); // 非壓縮檔也允許上傳
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter
});

// 設定靜態檔案目錄
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// 添加首頁路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 處理檔案上傳
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('沒有檔案被上傳');
  }
  
  const studentId = req.body.studentId;
  const week = req.body.week;
  const uploadPath = path.join('uploads', studentId, `week${week}`);
  const filePath = path.join(uploadPath, req.file.filename);
  
  try {
    // 檢查是否為壓縮檔
    if (req.file.mimetype.includes('zip') || req.file.originalname.endsWith('.zip')) {
      // 解壓縮檔案
      const zip = new AdmZip(filePath);
      const extractPath = path.join(uploadPath, 'extracted');
      
      // 創建解壓縮目錄
      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true });
      }
      
      // 解壓縮
      zip.extractAllTo(extractPath, true);
      
      // 可選：刪除原始壓縮檔
      // fs.unlinkSync(filePath);
      
      res.json({
        message: '檔案上傳並解壓縮成功',
        studentId: studentId,
        week: week,
        originalFile: req.file.filename,
        extractedPath: `/uploads/${studentId}/week${week}/extracted`,
        studentUrl: `/student/${studentId}`
      });
    } else {
      res.json({
        message: '檔案上傳成功',
        studentId: studentId,
        week: week,
        path: `/uploads/${studentId}/week${week}/${req.file.filename}`,
        studentUrl: `/student/${studentId}`
      });
    }
  } catch (error) {
    console.error('處理檔案時發生錯誤：', error);
    res.status(500).json({
      error: '處理檔案時發生錯誤',
      details: error.message
    });
  }
});

// 修改獲取檔案列表的路由以包含解壓縮的檔案
app.get('/files/:studentId', (req, res) => {
  const studentId = req.params.studentId;
  const studentDir = path.join('uploads', studentId);
  const result = [];
  
  if (!fs.existsSync(studentDir)) {
    return res.json(result);
  }

  // 讀取所有週次目錄
  const weeks = fs.readdirSync(studentDir);
  
  weeks.forEach(week => {
    const weekDir = path.join(studentDir, week);
    const extractedDir = path.join(weekDir, 'extracted');
    let files = [];

    // 讀取主目錄的檔案
    if (fs.existsSync(weekDir)) {
      files = fs.readdirSync(weekDir)
        .filter(file => file !== 'extracted')
        .map(file => ({
          name: file,
          path: `/uploads/${studentId}/${week}/${file}`
        }));
    }

    // 讀取解壓縮目錄的檔案
    if (fs.existsSync(extractedDir)) {
      const extractedFiles = getAllFiles(extractedDir).map(file => ({
        name: path.relative(extractedDir, file),
        path: `/uploads/${studentId}/${week}/extracted/${path.relative(extractedDir, file)}`
      }));
      files = files.concat(extractedFiles);
    }

    result.push({
      week: week,
      files: files
    });
  });
  
  res.json(result);
});

// 遞迴獲取所有檔案的輔助函數
function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath));
    } else {
      results.push(filePath);
    }
  });
  
  return results;
}

// 學生作品展示頁面
app.get('/student/:studentId', (req, res) => {
  const studentId = req.params.studentId;
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

// 修改檔案預覽路由
app.get('/preview/:studentId/:week/*', (req, res) => {
  const studentId = req.params.studentId;
  const week = req.params.week;
  const filePath = req.params[0];
  const fullPath = path.resolve(__dirname, 'uploads', studentId, week, 'extracted', filePath);

  // 檢查檔案是否存在
  if (!fs.existsSync(fullPath)) {
    return res.status(404).send('檔案不存在');
  }

  // 如果是 HTML 檔案，注入必要的程式碼
  if (fullPath.endsWith('.html') || fullPath.endsWith('.htm')) {
    try {
      let htmlContent = fs.readFileSync(fullPath, 'utf8');
      const basePath = `/uploads/${studentId}/${week}/extracted/`;
      
      // 改進 p5.js 檢測邏輯
      const needsP5 = htmlContent.includes('p5.js') || 
                     htmlContent.includes('setup()') || 
                     htmlContent.includes('draw()') ||
                     htmlContent.includes('function setup') ||
                     htmlContent.includes('function draw') ||
                     htmlContent.includes('createCanvas');

      // 準備注入的內容
      const injectedContent = `
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <base href="${basePath}">
        <!-- 總是載入 p5.js，因為學生作品很可能會用到 -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/addons/p5.sound.min.js"></script>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          canvas {
            display: block;
          }
        </style>
        <script>
          // 修正相對路徑
          document.addEventListener('DOMContentLoaded', function() {
            const base = '${basePath}';
            document.querySelectorAll('img, script[src], link[href], source[src]').forEach(el => {
              if (el.src && el.src.startsWith('/')) {
                el.src = base + el.src.slice(1);
              }
              if (el.href && el.href.startsWith('/')) {
                el.href = base + el.href.slice(1);
              }
            });
          });
        </script>
      `;

      // 移除可能存在的 DOCTYPE 宣告
      htmlContent = htmlContent.replace(/<!DOCTYPE[^>]*>/i, '');
      
      // 確保有完整的 HTML 結構
      if (!htmlContent.includes('<html')) {
        htmlContent = `<html lang="en">${htmlContent}</html>`;
      }
      
      // 注入內容到 head 中
      if (htmlContent.includes('<head>')) {
        htmlContent = htmlContent.replace('<head>', '<head>' + injectedContent);
      } else {
        // 如果沒有 head 標籤，在 html 標籤後添加
        htmlContent = htmlContent.replace('<html', '<html lang="en">' + '<head>' + injectedContent + '</head>');
      }

      // 確保有 body 標籤
      if (!htmlContent.includes('<body>')) {
        const [beforeBody, afterBody] = htmlContent.split('</head>');
        htmlContent = beforeBody + '</head><body>' + (afterBody || '') + '</body></html>';
      }

      console.log('提供 HTML 內容：', {
        path: fullPath,
        size: htmlContent.length,
        hasP5: needsP5,
        preview: htmlContent.substring(0, 200)
      });

      res.send(htmlContent);
    } catch (error) {
      console.error('讀取或處理 HTML 檔案時發生錯誤：', error);
      res.status(500).send('處理 HTML 檔案時發生錯誤');
    }
  } else {
    // 其他檔案使用絕對路徑發送
    res.sendFile(fullPath);
  }
});

// 移除 HTTPS 相關設定，改用 HTTP
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HTTP 伺服器運行在 port ${PORT}`);
});