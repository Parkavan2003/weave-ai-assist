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
    const { messages, chatId, projectId } = await req.json();
    
    if (!messages || !chatId || !projectId) {
      throw new Error('Missing required parameters: messages, chatId, and projectId');
    }

    console.log('Processing chat completion for chat:', chatId, 'project:', projectId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get project details including system prompt
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('system_prompt')
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('Project fetch error:', projectError);
      throw new Error('Failed to fetch project details');
    }

    // Prepare messages for OpenAI with system prompt
    const openaiMessages = [
      { role: 'system', content: project.system_prompt || 'You are a helpful AI assistant.' },
      ...messages
    ];

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Calling OpenAI API with', openaiMessages.length, 'messages');

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    console.log('Generated response, saving to database...');

    // Save assistant message to database
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'assistant',
        content: assistantMessage,
      });

    if (messageError) {
      console.error('Message save error:', messageError);
      throw new Error('Failed to save assistant message');
    }

    console.log('Chat completion successful');

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-completion function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});