# TailorTalks

**TailorTalks** is a personalized language learning platform powered by [Vapi](https://www.vapi.ai). With TailorTalks, teachers can design and deploy fully customized voice AI assistants, monitor student progress in real time, and evaluate conversations with automated insights.

**TailorTalks** offers the opportunity to truly offer personalized learning for everyone.

---

## ✨ Features

- **Custom Voice Assistants** – Build assistants tailored to each student's language level and subject
- **Real-Time Monitoring** – View active calls, listen in, and observe transcripts as they happen
- **Live Assistant Control** – Send real-time prompts or hints to guide the conversation
- **Performance Analysis** – Automatically capture summaries, transcripts, and recordings for each call
- **Knowledge Uploads** – Enhance assistant responses with personalized lesson content

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/TailorTalks.git
cd TailorTalks
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file inside both the `frontend/` and `teachAI/` folders.

**frontend/.env**

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**backend/.env**

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role
VAPI_API_KEY=your-vapi-api-key
VAPI_PHONE_NUMBER_ID=your-vapi-phone-number-id
```

### 4. Run the App Locally

Open **two terminals**:

**Terminal 1 – Backend**

```bash
cd teachAI
cd backend
python app.py
```

**Terminal 2 – Frontend**

```bash
cd teachAI
npm run dev
```

## 🔧 Configuration

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key from the API settings
3. Set up your database schema for users, assistants, and call data

### Vapi Integration

1. Sign up at [vapi.ai](https://www.vapi.ai)
2. Create your API key and phone number
3. Configure your voice assistants and squads through the Vapi dashboard

---

## 📱 Usage

### For Teachers

1. **Create Assistants**: Design custom voice AI tutors for different subjects and skill levels
2. **Monitor Sessions**: Watch live conversations and student progress in real-time
3. **Analyze Performance**: Review automated summaries and insights from each session
4. **Upload Content**: Add lesson materials to enhance assistant knowledge
