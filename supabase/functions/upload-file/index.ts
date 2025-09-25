import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    const userId = formData.get('userId') as string;

    if (!file || !projectId || !userId) {
      throw new Error('Missing required parameters: file, projectId, and userId');
    }

    console.log('Processing file upload:', file.name, 'for project:', projectId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log('Uploading file to storage at path:', filePath);

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(filePath, file);

    if (uploadError) {
      console.error('File upload error:', uploadError);
      throw new Error('Failed to upload file to storage');
    }

    console.log('File uploaded successfully, saving metadata...');

    // Save file metadata to database
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .insert({
        project_id: projectId,
        name: file.name,
        size: file.size,
        type: file.type,
        storage_path: filePath,
      })
      .select()
      .single();

    if (fileError) {
      console.error('File metadata save error:', fileError);
      throw new Error('Failed to save file metadata');
    }

    // Get OpenAI API key and upload to OpenAI if available
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    let openaiFileId = null;

    if (openaiApiKey && file.size <= 20 * 1024 * 1024) { // 20MB limit for OpenAI
      try {
        console.log('Uploading file to OpenAI...');
        
        const openaiFormData = new FormData();
        openaiFormData.append('file', file);
        openaiFormData.append('purpose', 'assistants');

        const openaiResponse = await fetch('https://api.openai.com/v1/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: openaiFormData,
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          openaiFileId = openaiData.id;
          console.log('File uploaded to OpenAI with ID:', openaiFileId);
        } else {
          console.warn('Failed to upload to OpenAI:', await openaiResponse.text());
        }
      } catch (error) {
        console.warn('OpenAI upload failed:', error);
      }
    }

    console.log('File upload process completed successfully');

    return new Response(JSON.stringify({ 
      file: fileData,
      openaiFileId,
      message: 'File uploaded successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in upload-file function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});