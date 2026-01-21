// Email Module
// Handles sending invitation emails via Supabase Edge Function

const Email = {
    // Send invitation email to a guest
    // Set isConfirmation: true to send as a post-RSVP confirmation with registry links
    async sendInvitation(invitation, event, { isConfirmation = false } = {}) {
        try {
            const rsvpLink = Invitations.getRSVPLink(invitation.token);

            // Format the date in the browser (which has correct timezone)
            // This ensures the email shows the same time the creator intended
            const formattedEventDate = Events.formatDate(event.event_date);

            const response = await fetch(`${SUPABASE_URL}/functions/v1/send-invitation-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    to: invitation.email,
                    guestName: invitation.name || null,
                    eventTitle: event.title,
                    eventDate: event.event_date,
                    formattedEventDate: formattedEventDate, // Pre-formatted date string
                    eventLocation: event.location || null,
                    eventDescription: event.description || null,
                    rsvpLink: rsvpLink,
                    templateId: event.template || 'shabby-chic',
                    customImageUrl: event.custom_image_url || null,
                    isConfirmation: isConfirmation,
                    registryLinks: event.registry_links || null
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to send email');
            }

            // Update invitation sent_at timestamp
            await window.supabaseClient
                .from('invitations')
                .update({ sent_at: new Date().toISOString() })
                .eq('id', invitation.id);

            return { success: true, id: data.id };
        } catch (error) {
            console.error('Send invitation email error:', error);
            return { success: false, error: error.message };
        }
    },

    // Send emails to multiple invitations
    async sendBulk(invitations, event, onProgress) {
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < invitations.length; i++) {
            const invitation = invitations[i];

            // Skip invitations without email
            if (!invitation.email) {
                results.failed++;
                results.errors.push({ email: 'No email', error: 'No email address' });
                continue;
            }

            const result = await this.sendInvitation(invitation, event);

            if (result.success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push({ email: invitation.email, error: result.error });
            }

            // Report progress
            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: invitations.length,
                    success: results.success,
                    failed: results.failed
                });
            }

            // Small delay between emails to avoid rate limiting
            if (i < invitations.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        return results;
    },

    // Check if email service is configured
    async checkConfiguration() {
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/send-invitation-email`, {
                method: 'OPTIONS',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }
};

// Export Email module
window.Email = Email;
