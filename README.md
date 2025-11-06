# Olive - Mental Health Companion

Olive is a voice-first mental health companion designed to provide evidence-based coping skills (from CBT, DBT, and ACT) through real-time, supportive conversations. It's built as a modern web application using React, TypeScript, and the Google Gemini API.

## ✨ Features

- **Voice-First Interface**: Engage in natural, spoken conversations with an AI companion.
- **Real-time Transcription**: See a live transcript of your conversation.
- **Dynamic Voice Visualization**: An animated orb pulses in response to your voice and Olive's, providing clear visual feedback on who is speaking.
- **Text Chat Alternative**: A classic text-based chat interface is available for users who prefer typing.
- **Simulated Authentication**: A complete, albeit simulated, user login and signup flow.
- **Personalized Experience**: A slide-out menu provides access to settings, profile, and chat history.
- **One-time Disclaimer**: Ensures users acknowledge the app's role as a companion, not a medical tool.
- **Modern & Responsive Design**: A clean, calming, and minimalist UI built with Tailwind CSS.

## 🛠️ Project Structure

The project is structured to be modular and scalable, with a clear separation of concerns.

```
/
├── public/
│   └── vite.svg            # Placeholder icon
├── src/
│   ├── components/         # Reusable React components
│   │   ├── icons/          # SVG icon components
│   │   ├── App.tsx         # Main application component, handles routing and state
│   │   ├── ChatView.tsx    # Component for the text-based chat interface
│   │   ├── DisclaimerModal.tsx # Modal shown on first login
│   │   ├── LoadingScreen.tsx # Loading animation screen
│   │   ├── LoginScreen.tsx # User login/signup component
│   │   ├── MainScreen.tsx  # Main container after login, switches between Voice/Chat
│   │   ├── Modal.tsx       # Generic modal component
│   │   ├── ProfileModal.tsx # Modal to display user profile
│   │   ├── SettingsModal.tsx # Placeholder modal for app settings
│   │   ├── SideMenu.tsx    # Slide-out navigation menu
│   │   └── VoiceView.tsx   # Component for the voice-first interface
│   │
│   ├── hooks/
│   │   └── useOrbAnimation.ts # Custom hook for Canvas-based orb animation
│   │
│   ├── services/
│   │   ├── geminiService.ts # Manages all interactions with the Google Gemini API (Live and Chat)
│   │   └── supabaseService.ts # Placeholder service to simulate user authentication
│   │
│   ├── types.ts            # TypeScript type definitions
│   └── index.tsx           # Entry point for the React application
│
├── .gitignore              # Git ignore file
├── index.html              # The single HTML page for the application
├── metadata.json           # Application metadata, including permissions
└── README.md               # This file
```

## 🚀 Getting Started

To run this project, you need a Google Gemini API key.

### Prerequisites

- A modern web browser like Chrome or Firefox.
- A Google Gemini API key.

### Setup

1.  **Set up the API Key**: The application expects the Gemini API key to be available as an environment variable named `API_KEY`. When running in an environment like AI Studio, this is typically configured for you. If running locally, you would need to set this variable.

2.  **Open `index.html`**: Simply open the `index.html` file in a web browser. The application is self-contained and will start running.

3.  **Grant Microphone Permissions**: The voice interface requires access to your microphone. Your browser will prompt you for permission the first time you use the app. This is necessary for the voice conversation feature to work.

### How It Works

- The application starts with a splash screen and then a loading screen that simulates an authentication check.
- If not "logged in", you are presented with a login screen. You can use any of the mock login options.
- Upon first login, you must accept a disclaimer. This is only shown once and is tracked using `localStorage`.
- The main screen defaults to the **Voice View**. The app will connect to the Gemini Live API and you can start talking.
- You can open the side menu to switch to **Chat View**, start a new chat, or view your profile.
