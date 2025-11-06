import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import * as geminiService from '../services/geminiService';

const ChatView: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        geminiService.startChatSession();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const responseText = await geminiService.sendChatMessage(userMessage.text);
            const modelMessage: ChatMessage = { role: 'model', text: responseText };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Failed to get chat response:", error);
            const errorMessage: ChatMessage = { role: 'model', text: 'Sorry, I encountered an error. Please try again.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-olive-deep p-4 pt-20 pb-4">
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 relative">
                {messages.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center animate-fade-in">
                        <div className="text-center text-olive-sage/70">
                            <h2 className="text-xl font-medium">This is a safe space to unload.</h2>
                            <p>What's on your mind today?</p>
                        </div>
                    </div>
                )}
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`inline-block p-3 rounded-lg max-w-lg ${msg.role === 'user' ? 'bg-olive-sage text-white' : 'bg-olive-accent text-olive-light'}`}>
                            {msg.text.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                         <div className="inline-block p-3 rounded-lg max-w-lg bg-olive-accent text-olive-light">
                            <span className="animate-pulse">...</span>
                         </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="flex items-center space-x-2 pt-2 border-t border-olive-sage/50">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type your message..."
                    className="flex-1 p-3 bg-olive-accent border border-olive-sage rounded-md text-olive-light focus:ring-2 focus:ring-olive-mint focus:outline-none"
                    disabled={isLoading}
                />
                <button onClick={handleSend} disabled={isLoading || !input.trim()} className="bg-olive-sage text-white p-3 rounded-md hover:bg-olive-mint hover:text-olive-accent transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                        <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
export default ChatView;