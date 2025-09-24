import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ProjectCard } from '@/components/ProjectCard';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { ChatInterface } from '@/components/ChatInterface';
import { FileUpload } from '@/components/FileUpload';
import { Plus, Bot, LogOut, Settings } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  created_at: string;
  updated_at: string;
  chats?: { id: string }[];
}

interface Chat {
  id: string;
  title: string;
  project_id: string;
  created_at: string;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  storage_path: string;
  created_at: string;
}

const Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadProjects();
  }, [user, navigate]);

  useEffect(() => {
    if (selectedProject) {
      loadChats();
      loadFiles();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          chats:chats(id)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadChats = async () => {
    if (!selectedProject) return;

    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChats(data || []);
    } catch (error) {
      console.error('Error loading chats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chats',
        variant: 'destructive',
      });
    }
  };

  const loadFiles = async () => {
    if (!selectedProject) return;

    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load files',
        variant: 'destructive',
      });
    }
  };

  const createProject = async (name: string, description: string, systemPrompt: string) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name,
          description,
          system_prompt: systemPrompt,
          user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Project created successfully',
      });

      loadProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to create project',
        variant: 'destructive',
      });
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Project deleted successfully',
      });

      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setSelectedChat(null);
      }

      loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete project',
        variant: 'destructive',
      });
    }
  };

  const createNewChat = async () => {
    if (!selectedProject) return;

    try {
      const { data, error } = await supabase
        .from('chats')
        .insert({
          project_id: selectedProject.id,
          title: 'New Chat',
        })
        .select()
        .single();

      if (error) throw error;

      const newChat = data as Chat;
      setChats(prev => [newChat, ...prev]);
      setSelectedChat(newChat);

      toast({
        title: 'Success',
        description: 'New chat created',
      });
    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to create chat',
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading your chatbots...</p>
        </div>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">Chatbot Platform</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">Your Projects</h2>
              <p className="text-muted-foreground">
                Create and manage your AI chatbot projects
              </p>
            </div>
            <Button onClick={() => setCreateProjectOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>

          {projects.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first AI chatbot project to get started
                </p>
                <Button onClick={() => setCreateProjectOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={(project) => setSelectedProject(project as any)}
                  onDelete={deleteProject}
                />
              ))}
            </div>
          )}
        </main>

        <CreateProjectDialog
          open={createProjectOpen}
          onOpenChange={setCreateProjectOpen}
          onCreateProject={createProject}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedProject(null);
                setSelectedChat(null);
              }}
            >
              ← Back to Projects
            </Button>
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">{selectedProject.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Tabs defaultValue="chat" className="h-[calc(100vh-80px)]">
          <div className="border-b px-4">
            <TabsList>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chat" className="h-full m-0">
            <ChatInterface
              project={selectedProject}
              selectedChat={selectedChat}
              onChatSelect={(chat) => setSelectedChat(chat as any)}
              onNewChat={createNewChat}
              chats={chats}
            />
          </TabsContent>

          <TabsContent value="files" className="p-6">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-lg font-semibold mb-4">Project Files</h3>
              <FileUpload
                projectId={selectedProject.id}
                files={files}
                onFilesChange={loadFiles}
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="p-6">
            <div className="max-w-2xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Project Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium">System Prompt</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedProject.system_prompt}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Description</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedProject.description || 'No description provided'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;