import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  storage_path: string;
  created_at: string;
}

interface FileUploadProps {
  projectId: string;
  files: FileItem[];
  onFilesChange: () => void;
}

export const FileUpload = ({ projectId, files, onFilesChange }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) return;

    setUploading(true);
    try {
      for (const file of acceptedFiles) {
        if (file.size > 20 * 1024 * 1024) { // 20MB limit
          toast({
            title: 'File too large',
            description: `${file.name} is larger than 20MB`,
            variant: 'destructive',
          });
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);
        formData.append('userId', user.id);

        const { error } = await supabase.functions.invoke('upload-file', {
          body: formData,
        });

        if (error) {
          toast({
            title: 'Upload failed',
            description: `Failed to upload ${file.name}`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'File uploaded',
            description: `${file.name} uploaded successfully`,
          });
        }
      }
      
      onFilesChange();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload error',
        description: 'An error occurred during upload',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }, [projectId, user, toast, onFilesChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploading,
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const deleteFile = async (file: FileItem) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      toast({
        title: 'File deleted',
        description: `${file.name} has been deleted`,
      });
      
      onFilesChange();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary hover:bg-primary/5'
            } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            )}
            <h3 className="text-lg font-medium mb-2">
              {uploading ? 'Uploading...' : 'Upload Files'}
            </h3>
            <p className="text-muted-foreground">
              {isDragActive
                ? 'Drop files here...'
                : 'Drag and drop files here, or click to browse'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Maximum file size: 20MB
            </p>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-medium mb-3">Uploaded Files</h4>
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <File className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)} • {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteFile(file)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};