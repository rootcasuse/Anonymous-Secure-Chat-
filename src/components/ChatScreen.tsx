import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal, X, Image, Mic, Shield, Key, FileText, Settings } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useCrypto } from '../context/CryptoContext';
import MessageList from './MessageList';
import DocumentSigner from './DocumentSigner';
import Button from './ui/Button';

interface ChatScreenProps {
  onLeave: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({ onLeave }) => {
  const { messages, sendMessage, leaveChat, pairingCode, isPaired } = useChat();
  const { certificate } = useCrypto();
  const [messageInput, setMessageInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [showDocumentSigner, setShowDocumentSigner] = useState(false);
  const [showCertInfo, setShowCertInfo] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const recordingTimer = useRef<number>();

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isRecording) {
      recordingTimer.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } else {
      clearInterval(recordingTimer.current);
      setRecordingTime(0);
    }
    return () => clearInterval(recordingTimer.current);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !isPaired) return;
    try {
      await sendMessage(messageInput, 'text');
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isPaired) return;

    if (file.size > 1024 * 1024) {
      alert('File too large. Please select an image under 1MB.');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        await sendMessage(dataUrl, 'image');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startRecording = async () => {
    if (!isPaired) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      setIsRecording(true);
      setAudioChunks([]);

      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          setAudioChunks((chunks) => [...chunks, e.data]);
        }
      };

      recorder.start();
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorder.current) return;

    return new Promise<void>((resolve) => {
      mediaRecorder.current!.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async (e) => {
          const audioDataUrl = e.target?.result as string;
          try {
            await sendMessage(audioDataUrl, 'audio');
          } catch (error) {
            console.error('Failed to send audio:', error);
          }
        };
        reader.readAsDataURL(audioBlob);
        
        if (audioStream) {
          audioStream.getTracks().forEach(track => track.stop());
        }
        setAudioStream(null);
        setIsRecording(false);
        setAudioChunks([]);
        resolve();
      };

      mediaRecorder.current!.stop();
    });
  };

  const handleAudioRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleLeave = () => {
    if (isRecording) {
      stopRecording();
    }
    leaveChat();
    onLeave();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (showDocumentSigner) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 p-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Document Signer</h1>
            <button
              onClick={() => setShowDocumentSigner(false)}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <DocumentSigner />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="font-medium">Secure Connection</span>
          </div>
          {pairingCode && (
            <button
              onClick={() => setShowCode(!showCode)}
              className="flex items-center space-x-2 px-3 py-1 bg-gray-700 rounded-full text-sm hover:bg-gray-600 transition-colors"
            >
              <Key className="w-4 h-4" />
              <span>{showCode ? pairingCode : '••••••'}</span>
            </button>
          )}
          {certificate && (
            <button
              onClick={() => setShowCertInfo(!showCertInfo)}
              className="flex items-center space-x-2 px-3 py-1 bg-indigo-700 rounded-full text-sm hover:bg-indigo-600 transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">{certificate.subject}</span>
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDocumentSigner(true)}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            title="Document Signer"
          >
            <FileText className="w-5 h-5 text-blue-400" />
          </button>
          <button
            onClick={handleLeave}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Leave Chat"
          >
            <X className="w-5 h-5 text-red-400" />
          </button>
        </div>
      </div>

      {/* Certificate Info Modal */}
      {showCertInfo && certificate && (
        <div className="absolute top-16 left-4 right-4 z-10 bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Your Certificate
            </h3>
            <button
              onClick={() => setShowCertInfo(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400">Subject:</span>
              <span className="ml-2 font-mono">{certificate.subject}</span>
            </div>
            <div>
              <span className="text-gray-400">Issued:</span>
              <span className="ml-2">{formatDate(certificate.issuedAt)}</span>
            </div>
            <div>
              <span className="text-gray-400">Expires:</span>
              <span className="ml-2">{formatDate(certificate.expiresAt)}</span>
            </div>
            <div>
              <span className="text-gray-400">ID:</span>
              <span className="ml-2 font-mono text-xs break-all">{certificate.id}</span>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
        {!isPaired ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Shield className="w-12 h-12 mb-4 text-gray-500" />
            <p className="text-lg mb-2">Waiting for connection...</p>
            <p className="text-sm">Share your code with someone to start chatting</p>
            {certificate && (
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">Your digital identity is ready</p>
                <p className="text-xs font-mono text-indigo-400">{certificate.subject}</p>
              </div>
            )}
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
        <div ref={messageEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-gray-800 p-4 border-t border-gray-700">
        <div className="flex items-end space-x-2">
          <div className="flex-1 bg-gray-700 rounded-lg">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isPaired ? "Type a message..." : "Waiting for connection..."}
              className="w-full bg-transparent border-0 p-3 text-white placeholder-gray-400 focus:ring-0 resize-none"
              disabled={!isPaired}
              rows={1}
            />
            <div className="px-3 pb-2 flex items-center space-x-2">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                disabled={!isPaired}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`text-gray-400 hover:text-white transition-colors ${!isPaired && 'opacity-50 cursor-not-allowed'}`}
                disabled={!isPaired}
                title="Upload Image"
              >
                <Image className="w-5 h-5" />
              </button>
              <button
                onClick={handleAudioRecording}
                className={`relative ${
                  isRecording ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-white'
                } transition-colors ${!isPaired && 'opacity-50 cursor-not-allowed'}`}
                disabled={!isPaired}
                title="Record Audio"
              >
                <Mic className="w-5 h-5" />
                {isRecording && (
                  <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-2 py-1 rounded text-xs">
                    {formatTime(recordingTime)}
                  </span>
                )}
              </button>
              <div className="flex-1 text-right">
                <span className="text-xs text-gray-500">
                  <Shield className="w-3 h-3 inline-block mr-1" />
                  E2E encrypted & signed
                </span>
              </div>
            </div>
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !isPaired}
            className="p-3 h-10"
          >
            <SendHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;