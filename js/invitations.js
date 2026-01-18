// Invitations Module
// Handles all RSVP invitation operations with Supabase

const Invitations = {
    // Create invitations for an event (batch)
    async create(eventId, emails) {
        try {
            const invitations = emails.map(email => ({
                event_id: eventId,
                email: email.trim().toLowerCase(),
                status: 'pending'
            }));

            const { data, error } = await window.supabaseClient
                .from('invitations')
                .insert(invitations)
                .select();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Create invitations error:', error);
            return { success: false, error: error.message };
        }
    },

    // Create a single invitation
    async createSingle(eventId, email) {
        try {
            const { data, error } = await window.supabaseClient
                .from('invitations')
                .insert({
                    event_id: eventId,
                    email: email ? email.trim().toLowerCase() : null,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Create invitation error:', error);
            return { success: false, error: error.message };
        }
    },

    // Get all invitations for an event
    async getByEvent(eventId) {
        try {
            const { data, error } = await window.supabaseClient
                .from('invitations')
                .select('*')
                .eq('event_id', eventId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get invitations error:', error);
            return { success: false, error: error.message };
        }
    },

    // Get invitation by token (public - no auth required)
    async getByToken(token) {
        try {
            const { data, error } = await window.supabaseClient
                .from('invitations')
                .select(`
                    *,
                    events (
                        id,
                        title,
                        description,
                        event_date,
                        location,
                        template,
                        custom_image_url,
                        registry_links
                    )
                `)
                .eq('token', token)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get invitation by token error:', error);
            return { success: false, error: error.message };
        }
    },

    // Mark invitation as opened (tracking)
    async markOpened(token) {
        try {
            const { data, error } = await window.supabaseClient
                .from('invitations')
                .update({
                    status: 'opened',
                    opened_at: new Date().toISOString()
                })
                .eq('token', token)
                .eq('status', 'pending') // Only update if still pending
                .select()
                .single();

            if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows" error
            return { success: true, data };
        } catch (error) {
            console.error('Mark opened error:', error);
            return { success: false, error: error.message };
        }
    },

    // Respond to invitation (public - RSVP)
    async respond(token, responseData) {
        try {
            const { data, error } = await window.supabaseClient
                .from('invitations')
                .update({
                    name: responseData.name,
                    phone: responseData.phone,
                    email: responseData.email || null,
                    status: responseData.attending ? 'accepted' : 'declined',
                    guest_count: responseData.attending ? (responseData.guest_count || 1) : 0,
                    message: responseData.message || null,
                    responded_at: new Date().toISOString()
                })
                .eq('token', token)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('RSVP respond error:', error);
            return { success: false, error: error.message };
        }
    },

    // Delete invitation
    async delete(invitationId) {
        try {
            const { error } = await window.supabaseClient
                .from('invitations')
                .delete()
                .eq('id', invitationId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Delete invitation error:', error);
            return { success: false, error: error.message };
        }
    },

    // Get invitation stats for an event
    async getStats(eventId) {
        try {
            const { data, error } = await window.supabaseClient
                .from('invitations')
                .select('status, guest_count')
                .eq('event_id', eventId);

            if (error) throw error;

            const stats = {
                total: data.length,
                pending: 0,
                opened: 0,
                accepted: 0,
                declined: 0,
                totalGuests: 0
            };

            data.forEach(inv => {
                stats[inv.status]++;
                if (inv.status === 'accepted') {
                    stats.totalGuests += inv.guest_count || 1;
                }
            });

            return { success: true, data: stats };
        } catch (error) {
            console.error('Get stats error:', error);
            return { success: false, error: error.message };
        }
    },

    // Generate RSVP link for an invitation
    getRSVPLink(token) {
        const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
        return `${baseUrl}rsvp.html?token=${token}`;
    },

    // Format phone number for display
    formatPhone(phone) {
        if (!phone) return '-';
        // Basic US phone formatting
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
        }
        return phone;
    },

    // Get status display info
    getStatusDisplay(status) {
        const statusMap = {
            pending: { label: 'Pending', class: 'status-pending' },
            opened: { label: 'Opened', class: 'status-opened' },
            accepted: { label: 'Attending', class: 'status-accepted' },
            declined: { label: 'Declined', class: 'status-declined' }
        };
        return statusMap[status] || { label: status, class: '' };
    }
};

// Export Invitations module
window.Invitations = Invitations;
