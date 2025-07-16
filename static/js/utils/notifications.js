let notificationId = 0;

export function showNotification(message, type = 'info', duration = 5000) {
    // Get or create notification container
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        document.body.appendChild(container);
    }
    
    // Limit the number of visible notifications
    const existingNotifications = container.querySelectorAll('.notification:not(.hiding)');
    if (existingNotifications.length >= 5) {
        // Remove the oldest notification
        const oldest = existingNotifications[0];
        dismissNotification(oldest);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    const currentId = ++notificationId;
    notification.className = `notification notification-${type}`;
    notification.setAttribute('data-notification-id', currentId);
    
    const iconMap = {
        success: 'fa-check',
        error: 'fa-times',
        info: 'fa-info',
        warning: 'fa-exclamation'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                <i class="fas ${iconMap[type] || iconMap.info}"></i>
            </div>
            <div class="notification-text">${message}</div>
        </div>
        <button class="notification-close" onclick="dismissNotification(this.parentElement)">
            <i class="fas fa-times"></i>
        </button>
        <div class="notification-progress">
            <div class="notification-progress-bar"></div>
        </div>
    `;
    
    // Add to container
    container.appendChild(notification);
    
    // Trigger show animation
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });
    
    // Set up progress bar animation
    if (duration > 0) {
        const progressBar = notification.querySelector('.notification-progress-bar');
        if (progressBar) {
            // Start progress animation
            setTimeout(() => {
                progressBar.style.width = '0%';
                progressBar.style.transition = `width ${duration}ms linear`;
            }, 100);
        }
        
        // Auto-dismiss after specified duration
        setTimeout(() => {
            if (notification.parentNode) {
                dismissNotification(notification);
            }
        }, duration);
    }
    
    // Add click to dismiss (except on close button)
    notification.addEventListener('click', (e) => {
        if (!e.target.closest('.notification-close')) {
            dismissNotification(notification);
        }
    });
    
    return notification;
}

function dismissNotification(notification) {
    if (!notification || notification.classList.contains('hiding')) {
        return;
    }
    
    notification.classList.add('hiding');
    notification.classList.remove('show');
    
    // Remove from DOM after animation
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Make dismissNotification globally available
window.dismissNotification = dismissNotification;

// Enhanced notification functions with better defaults
export function showSuccess(message, duration = 4000) {
    return showNotification(message, 'success', duration);
}

export function showError(message, duration = 7000) {
    return showNotification(message, 'error', duration);
}

export function showWarning(message, duration = 6000) {
    return showNotification(message, 'warning', duration);
}

export function showInfo(message, duration = 5000) {
    return showNotification(message, 'info', duration);
}

// Persistent notification (no auto-dismiss)
export function showPersistent(message, type = 'info') {
    return showNotification(message, type, 0);
}

// Clear all notifications
export function clearAllNotifications() {
    const container = document.getElementById('notification-container');
    if (container) {
        const notifications = container.querySelectorAll('.notification');
        notifications.forEach(notification => {
            dismissNotification(notification);
        });
    }
}

// Make functions globally available with better names
window.showNotification = showNotification;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;
window.showPersistent = showPersistent;
window.clearAllNotifications = clearAllNotifications;
