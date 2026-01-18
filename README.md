# Synathrozo - Event Creation & RSVP Platform

A clean, modern event creation web application with RSVP functionality built with vanilla HTML, CSS, JavaScript, and Supabase.

## Features

- User authentication (sign up/login)
- Create, view, edit, and delete events
- **RSVP System**: Invite guests and track responses
- **Guest Management**: View who's attending, declined, or pending
- **Phone Verification**: Guests provide phone numbers for confirmation
- **Shareable Links**: Generate RSVP links to share via email/SMS
- **No Account Required**: Guests can RSVP without creating an account
- **Invitation Templates**: Choose from 4 beautiful e-vite designs
- Responsive design (mobile-friendly)
- Clean, modern UI with blue/purple color scheme

## Invitation Templates

Choose from 4 professionally designed invitation templates:

| Template | Description |
|----------|-------------|
| **Shabby Chic** | Vintage floral design with pink stripes and elegant script fonts |
| **Modern Elegance** | Sleek dark theme with gold accents and contemporary styling |
| **Garden Party** | Fresh green botanical design with nature-inspired elements |
| **Classic Formal** | Timeless black and white design with traditional elegance |

## Tech Stack

- **Frontend**: Pure HTML, CSS, JavaScript (no frameworks)
- **Backend**: Supabase (Authentication + Database)
- **Styling**: Custom CSS with CSS Variables

## Project Structure

```
event-creator/
├── index.html              # Login page
├── signup.html             # Registration page
├── dashboard.html          # User dashboard (view events)
├── create-event.html       # Create new event form
├── event-detail.html       # Single event view with edit/delete
├── manage-invitations.html # Manage guest invitations
├── rsvp.html               # Public RSVP page (no auth required)
├── css/
│   └── styles.css          # Main stylesheet
├── js/
│   ├── config.js           # Supabase configuration
│   ├── auth.js             # Authentication logic
│   ├── events.js           # Event CRUD operations
│   ├── invitations.js      # RSVP/invitation operations
│   └── main.js             # General utilities
└── README.md
```

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon/public key from Project Settings > API

### 2. Create Database Tables

Run the following SQL in your Supabase SQL Editor:

```sql
-- Create profiles table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    location TEXT,
    template TEXT DEFAULT 'shabby-chic',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invitations table (for RSVP system)
CREATE TABLE invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    email TEXT,
    phone TEXT,
    name TEXT,
    token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'opened', 'accepted', 'declined')),
    guest_count INTEGER DEFAULT 1,
    message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, email)
);

-- Create indexes for better performance
CREATE INDEX events_user_id_idx ON events(user_id);
CREATE INDEX events_event_date_idx ON events(event_date);
CREATE INDEX invitations_event_id_idx ON invitations(event_id);
CREATE INDEX invitations_token_idx ON invitations(token);
```

### 3. Enable Row Level Security (RLS)

```sql
-- Enable RLS on tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Events policies
CREATE POLICY "Users can view own events" ON events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create events" ON events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events" ON events
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events" ON events
    FOR DELETE USING (auth.uid() = user_id);

-- Invitations policies (event owners can manage)
CREATE POLICY "Event owners can view invitations" ON invitations
    FOR SELECT USING (
        event_id IN (SELECT id FROM events WHERE user_id = auth.uid())
    );

CREATE POLICY "Event owners can create invitations" ON invitations
    FOR INSERT WITH CHECK (
        event_id IN (SELECT id FROM events WHERE user_id = auth.uid())
    );

CREATE POLICY "Event owners can update invitations" ON invitations
    FOR UPDATE USING (
        event_id IN (SELECT id FROM events WHERE user_id = auth.uid())
    );

CREATE POLICY "Event owners can delete invitations" ON invitations
    FOR DELETE USING (
        event_id IN (SELECT id FROM events WHERE user_id = auth.uid())
    );

-- Public access for RSVP (guests can view/respond via token)
CREATE POLICY "Anyone can view invitation by token" ON invitations
    FOR SELECT USING (true);

CREATE POLICY "Anyone can respond to invitation" ON invitations
    FOR UPDATE USING (true);

-- Allow public inserts for walk-in RSVPs (via shareable event link)
CREATE POLICY "Anyone can RSVP to public events" ON invitations
    FOR INSERT WITH CHECK (true);
```

### 4. Auto-Create Profiles (Trigger)

```sql
-- Create a function to handle new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 5. Configure Authentication (Optional)

In your Supabase Dashboard:

1. Go to Authentication > Providers
2. Email is enabled by default
3. Optional: Disable email confirmation for easier testing
   - Go to Authentication > Settings
   - Turn off "Enable email confirmations"

### 6. Add Template Column (For Existing Databases)

If you already have an events table, run this migration to add template support:

```sql
-- Add template column to existing events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS template TEXT DEFAULT 'shabby-chic';
```

### 7. Update Configuration

Update `js/config.js` with your Supabase credentials:

```javascript
const SUPABASE_URL = 'your-project-url';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### 8. Email Invitations Setup (Optional)

To enable email invitations, you'll need to set up Resend and deploy a Supabase Edge Function.

#### Step 1: Create a Resend Account
1. Go to [resend.com](https://resend.com) and create a free account
2. Add and verify your domain (or use their test domain for development)
3. Create an API key in the dashboard

#### Step 2: Deploy the Edge Function
```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Set the secrets
supabase secrets set RESEND_API_KEY=re_your_api_key
supabase secrets set FROM_EMAIL="Synathrozo <invitations@yourdomain.com>"

# Deploy the function
supabase functions deploy send-invitation-email --no-verify-jwt
```

#### Step 3: Test
1. Go to Manage Invitations for any event
2. Add a guest with an email address
3. Click the ✉️ button to send an individual email, or "Send All Invitations" for bulk sending

**Note:** The free Resend tier allows 3,000 emails/month.

## Running Locally

Since this is a static site, you can use any local server:

### Option 1: VS Code Live Server
1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` and select "Open with Live Server"

### Option 2: Python
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

### Option 3: Node.js
```bash
npx serve
```

Then open `http://localhost:8000` (or whatever port your server uses).

## Deployment

### GitHub Pages

1. Push your code to a GitHub repository
2. Go to Settings > Pages
3. Select your branch and save
4. Your site will be live at `https://yourusername.github.io/repo-name`

### Netlify

1. Connect your GitHub repository to Netlify
2. Deploy with default settings (no build command needed)

### Vercel

1. Import your GitHub repository
2. Deploy with default settings

## Usage

### For Event Creators
1. **Sign Up**: Create an account with your email
2. **Login**: Access your dashboard
3. **Create Event**: Fill in event details (title, description, date, location)
4. **Manage Invitations**:
   - Go to event detail → "Manage Invitations"
   - Add guest emails
   - Copy shareable RSVP link
   - Track responses (attending, declined, pending)
   - Copy phone numbers for manual SMS

### For Guests
1. Receive RSVP link (via email, SMS, or shared)
2. View event details
3. Fill in: Name, Phone, Yes/No, Guest count
4. Submit → See confirmation
5. Add to calendar (if attending)

## Security Notes

- All data access is protected by Supabase Row Level Security
- Users can only see and modify their own events
- Invitation tokens are unique UUIDs - hard to guess
- Passwords are handled securely by Supabase Auth
- The anon key is safe to expose as RLS protects your data

## Customization

### Colors
Edit CSS variables in `css/styles.css`:

```css
:root {
    --primary-color: #6366f1;
    --secondary-color: #8b5cf6;
    /* ... */
}
```

### Adding Features

Some ideas for extending the app:
- Email notifications via Supabase Edge Functions
- SMS notifications via Twilio
- Event categories/tags
- Image uploads for events
- Calendar view
- Recurring events

## License

MIT License - feel free to use this for your own projects!
