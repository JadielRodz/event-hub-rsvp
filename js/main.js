// Main Utilities Module
// General helper functions used across the application

const Utils = {
    // Show loading state on a button
    showLoading(button, text = 'Loading...') {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.innerHTML = `<span class="spinner"></span> ${text}`;
    },

    // Hide loading state on a button
    hideLoading(button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Submit';
    },

    // Show message to user
    showMessage(container, message, type = 'error') {
        container.textContent = message;
        container.className = `message ${type}`;
        container.style.display = 'block';

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                container.style.display = 'none';
            }, 5000);
        }
    },

    // Hide message
    hideMessage(container) {
        container.style.display = 'none';
    },

    // Validate email format
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Validate password strength
    isValidPassword(password) {
        return password.length >= 6;
    },

    // Get URL parameter
    getUrlParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Truncate text with ellipsis
    truncate(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },

    // Check if date is in the past
    isPastDate(dateString) {
        return new Date(dateString) < new Date();
    },

    // Format relative time (e.g., "2 days from now")
    getRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return `${Math.abs(diffDays)} days ago`;
        } else if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Tomorrow';
        } else if (diffDays < 7) {
            return `In ${diffDays} days`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `In ${weeks} week${weeks > 1 ? 's' : ''}`;
        } else {
            const months = Math.floor(diffDays / 30);
            return `In ${months} month${months > 1 ? 's' : ''}`;
        }
    }
};

// Navigation helper - update active nav link
function updateActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Initialize navigation on page load
document.addEventListener('DOMContentLoaded', () => {
    updateActiveNavLink();
});

// Export Utils module
window.Utils = Utils;
