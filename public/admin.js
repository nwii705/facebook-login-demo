// Load data when page loads
document.addEventListener('DOMContentLoaded', function() {
  loadStats();
  loadUsers();
});

// Load statistics
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();
    
    document.getElementById('total-users').textContent = stats.totalUsers;
    document.getElementById('recent-users').textContent = stats.recentUsers;
    
    const lastUpdated = new Date(stats.lastUpdated);
    document.getElementById('last-updated').textContent = lastUpdated.toLocaleTimeString('vi-VN');
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Load users list
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Đang tải dữ liệu...</td></tr>';
  
  try {
    const response = await fetch('/api/users');
    const users = await response.json();
    
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">Chưa có tài khoản nào được đăng ký</td></tr>';
      return;
    }
    
    tbody.innerHTML = '';
    
    users.forEach(user => {
      const row = document.createElement('tr');
      const createdDate = new Date(user.created_at).toLocaleString('vi-VN');
      const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString('vi-VN') : 'Chưa đăng nhập';
      
      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${user.email || 'N/A'}</td>
        <td><code style="background: #f1f3f4; padding: 2px 4px; border-radius: 3px;">${user.password}</code></td>
        <td>${user.last_ip || 'N/A'}</td>
        <td>${lastLogin}</td>
        <td>
          <button class="btn-delete" onclick="deleteUser(${user.id})">Xóa</button>
        </td>
      `;
      
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading users:', error);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #E74C3C;">Lỗi tải dữ liệu</td></tr>';
  }
}

// Delete user
async function deleteUser(userId) {
  if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) {
    return;
  }
  
  const button = event.target;
  const originalText = button.textContent;
  button.textContent = 'Đang xóa...';
  button.disabled = true;
  
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      loadUsers(); // Reload the list
      loadStats(); // Reload stats
      alert('Đã xóa tài khoản thành công!');
    } else {
      alert('Lỗi: ' + result.error);
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('Lỗi kết nối server');
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

// Export data
function exportData() {
  const data = {
    exportedAt: new Date().toISOString(),
    note: 'Dữ liệu tài khoản người dùng - Chỉ dùng cho mục đích test bảo mật'
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `user-data-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
  alert('Đã xuất dữ liệu! (Chỉ metadata, không bao gồm mật khẩu)');
}

// Clear all data
async function clearAllData() {
  if (!confirm('⚠️ CẢNH BÁO: Bạn có chắc muốn xóa TẤT CẢ dữ liệu? Hành động này không thể hoàn tác!')) {
    return;
  }
  
  if (!confirm('Xác nhận lần cuối: Xóa tất cả tài khoản?')) {
    return;
  }
  
  try {
    // This would require a new API endpoint
    const response = await fetch('/api/clear-all', {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      loadUsers();
      loadStats();
      alert('Đã xóa tất cả dữ liệu!');
    } else {
      alert('Lỗi: ' + result.error);
    }
  } catch (error) {
    console.error('Error clearing data:', error);
    alert('Lỗi kết nối server');
  }
}

// Auto refresh every 30 seconds
setInterval(() => {
  loadStats();
  loadUsers();
}, 30000);
