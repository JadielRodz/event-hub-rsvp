// Authentication Module
// Handles all user authentication operations with Supabase

const Auth = {
    // Sign up a new user with email and password
    // Note: Profile is created automatically via database trigger
    async signUp(email, password, fullName) {
        try {
            const { data, error } = await window.supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Sign up error:', error);
            return { success: false, error: error.message };
        }
    },

    // Sign in existing user
    async signIn(email, password) {
        try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Sign in error:', error);
            return { success: false, error: error.message };
        }
    },

    // Sign out current user
    async signOut() {
        try {
            const { error } = await window.supabaseClient.auth.signOut();
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }
    },

    // Get current logged in user
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await window.supabaseClient.auth.getUser();
            if (error) throw error;
            return user;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    },

    // Get current session
    async getSession() {
        try {
            const { data: { session }, error } = await window.supabaseClient.auth.getSession();
            if (error) throw error;
            return session;
        } catch (error) {
            console.error('Get session error:', error);
            return null;
        }
    },

    // Check if user is authenticated and redirect if not
    async requireAuth() {
        const user = await this.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return null;
        }
        return user;
    },

    // Redirect to dashboard if already logged in
    async redirectIfAuthenticated() {
        const user = await this.getCurrentUser();
        if (user) {
            window.location.href = 'dashboard.html';
        }
    },

    // Listen for auth state changes
    onAuthStateChange(callback) {
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }
};

// Export Auth module
window.Auth = Auth;
