import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, MessageCircle, Calendar, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  chats?: { id: string }[];
}

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onDelete: (projectId: string) => void;
}

export const ProjectCard = ({ project, onSelect, onDelete }: ProjectCardProps) => {
  const chatCount = project.chats?.length || 0;
  
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{project.name}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project.id);
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {project.description && (
          <CardDescription className="line-clamp-2">
            {project.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              <span>{chatCount} chats</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
            </div>
          </div>
          <Button onClick={() => onSelect(project)}>
            Open
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};