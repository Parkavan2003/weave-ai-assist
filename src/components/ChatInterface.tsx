import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Send, Loader2, User, Bot } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Chat {
  id: string;
  title: string;
  project_id: string;
}

interface Project {
  id: string;
  name: string;
  system_prompt: string;
}

interface ChatInterfaceProps {
  project: Project;
  selectedChat: Chat | null;
  onChatSelect: (chat: Chat) => void;
  onNewChat: () => void;
  chats: Chat[];
}

export const ChatInterface = ({
  project,
  selectedChat,
  onChatSelect,
  onNewChat,
  chats,
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [selectedChat]);

  const loadMessages = async () => {
    if (!selectedChat) return;

    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', selectedChat.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !selectedChat || !user) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    try {
      // Save user message to database
      const { error: saveError } = await supabase
        .from('messages')
        .insert({
          chat_id: selectedChat.id,
          role: 'user',
          content: userMessage,
        });

      if (saveError) throw saveError;

      // Update messages locally
      const newUserMessage = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: userMessage,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newUserMessage]);

      // Prepare messages for AI
      const allMessages = [...messages, newUserMessage].map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call the chat completion edge function
      const { data, error } = await supabase.functions.invoke('chat-completion', {
        body: {
          messages: allMessages,
          chatId: selectedChat.id,
          projectId: project.id,
        },
      });

      if (error) {
        // Extract error message from Supabase function response
        const errorDetails = error.details || error.message || 'Unknown error occurred';
        throw new Error(errorDetails);
      }

      // Add assistant message to local state
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: data.message,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      let errorMessage = 'Failed to send message';
      
      // Try to extract the specific error from the response
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full">
      {/* Chat Sidebar */}
      <div className="w-80 border-r bg-card">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{project.name}</h3>
            <Button onClick={onNewChat} size="sm">
              New Chat
            </Button>
          </div>
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="space-y-2">
              {chats.map((chat) => (
                <Card
                  key={chat.id}
                  className={`cursor-pointer transition-colors ${
                    selectedChat?.id === chat.id ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => onChatSelect(chat)}
                >
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">{selectedChat.title}</CardTitle>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0">
                          <Bot className="h-8 w-8 p-1 bg-primary text-primary-foreground rounded-full" />
                        </div>
                      )}
                      
                      <Card className={`max-w-[70%] ${
                        message.role === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-card'
                      }`}>
                        <CardContent className="p-3">
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </CardContent>
                      </Card>
                      
                      {message.role === 'user' && (
                        <div className="flex-shrink-0">
                          <User className="h-8 w-8 p-1 bg-secondary text-secondary-foreground rounded-full" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <Separator />
            
            <div className="p-4">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={loading}
                  className="flex-1"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={loading || !inputMessage.trim()}
                  size="icon"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No chat selected</h3>
              <p>Select a chat from the sidebar or create a new one to start chatting.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};