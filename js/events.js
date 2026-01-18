// Events Module
// Handles all event CRUD operations with Supabase

const Events = {
    // Available invitation templates
    templates: {
        'shabby-chic': {
            id: 'shabby-chic',
            name: 'Shabby Chic',
            description: 'Vintage floral design with pink stripes and elegant script fonts',
            preview: 'Soft pinks, florals, oval frames',
            colors: ['#b87878', '#f8e8e8', '#fef9f6']
        },
        'modern-dark': {
            id: 'modern-dark',
            name: 'Modern Elegance',
            description: 'Sleek dark theme with gold accents and contemporary styling',
            preview: 'Dark background, gold details',
            colors: ['#1a1a2e', '#d4af37', '#16213e']
        },
        'garden-party': {
            id: 'garden-party',
            name: 'Garden Party',
            description: 'Fresh green botanical design with nature-inspired elements',
            preview: 'Greens, botanicals, natural',
            colors: ['#4a7c59', '#e8f5e9', '#2d5a3d']
        },
        'classic-formal': {
            id: 'classic-formal',
            name: 'Classic Formal',
            description: 'Timeless black and white design with traditional elegance',
            preview: 'Black, white, serif fonts',
            colors: ['#2c2c2c', '#ffffff', '#666666']
        }
    },

    // Get all templates
    getTemplates() {
        return Object.values(this.templates);
    },

    // Get template by ID
    getTemplate(templateId) {
        return this.templates[templateId] || this.templates['shabby-chic'];
    },

    // Upload custom invitation image to Supabase Storage
    async uploadCustomImage(file) {
        try {
            const user = await Auth.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;

            // Upload to Supabase Storage
            const { data, error } = await supabaseClient
                .storage
                .from('invitation-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = supabaseClient
                .storage
                .from('invitation-images')
                .getPublicUrl(fileName);

            return { success: true, url: urlData.publicUrl };
        } catch (error) {
            console.error('Upload image error:', error);
            return { success: false, error: error.message };
        }
    },

    // Create a new event
    async create(eventData) {
        try {
            const user = await Auth.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            // Convert datetime-local value to ISO string with timezone
            const eventDate = new Date(eventData.event_date).toISOString();

            const insertData = {
                user_id: user.id,
                title: eventData.title,
                description: eventData.description,
                event_date: eventDate,
                location: eventData.location,
                template: eventData.template || 'shabby-chic'
            };

            // Add custom image URL if provided
            if (eventData.custom_image_url) {
                insertData.custom_image_url = eventData.custom_image_url;
            }

            // Add registry links if provided
            if (eventData.registry_links) {
                insertData.registry_links = eventData.registry_links;
            }

            const { data, error } = await supabaseClient
                .from('events')
                .insert(insertData)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Create event error:', error);
            return { success: false, error: error.message };
        }
    },

    // Get all events for current user
    async getAll() {
        try {
            const user = await Auth.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            const { data, error } = await supabaseClient
                .from('events')
                .select('*')
                .eq('user_id', user.id)
                .order('event_date', { ascending: true });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get events error:', error);
            return { success: false, error: error.message };
        }
    },

    // Get single event by ID
    async getById(eventId) {
        try {
            const { data, error } = await supabaseClient
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get event error:', error);
            return { success: false, error: error.message };
        }
    },

    // Update an existing event
    async update(eventId, eventData) {
        try {
            const user = await Auth.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            // Convert datetime-local value to ISO string with timezone
            const eventDate = new Date(eventData.event_date).toISOString();

            const updateFields = {
                title: eventData.title,
                description: eventData.description,
                event_date: eventDate,
                location: eventData.location,
                updated_at: new Date().toISOString()
            };

            // Only include template if provided
            if (eventData.template) {
                updateFields.template = eventData.template;
            }

            const { data, error } = await supabaseClient
                .from('events')
                .update(updateFields)
                .eq('id', eventId)
                .eq('user_id', user.id) // Ensure user owns the event
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Update event error:', error);
            return { success: false, error: error.message };
        }
    },

    // Delete an event
    async delete(eventId) {
        try {
            const user = await Auth.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            const { error } = await supabaseClient
                .from('events')
                .delete()
                .eq('id', eventId)
                .eq('user_id', user.id); // Ensure user owns the event

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Delete event error:', error);
            return { success: false, error: error.message };
        }
    },

    // Format date for display
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Format date for input field (converts to local time for datetime-local input)
    formatDateForInput(dateString) {
        const date = new Date(dateString);
        // Get local date components
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
};

// Export Events module
window.Events = Events;
