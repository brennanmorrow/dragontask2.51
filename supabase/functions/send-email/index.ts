import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function logDebugEvent(supabase: any, level: string, type: string, message: string, details: any = {}) {
  try {
    await supabase.from("debug_events").insert({
      level,
      type,
      message,
      details
    });
  } catch (error) {
    console.error("Failed to log debug event:", error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  let supabase;

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    // Create Supabase client
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let requestData;
    try {
      requestData = await req.json();
    } catch (e) {
      await logDebugEvent(supabase, "error", "email_function", "Invalid JSON in request body", { error: e });
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body", details: e.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { to, subject, html, text, cc, bcc, attachments } = requestData;

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      await logDebugEvent(supabase, "error", "email_function", "Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, and either html or text" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get email settings from system_settings table
    const { data: settingsData, error: settingsError } = await supabase
      .from("system_settings")
      .select("email_settings")
      .limit(1)
      .single();

    if (settingsError) {
      await logDebugEvent(supabase, "error", "email_function", "Failed to retrieve email settings", { error: settingsError });
      return new Response(
        JSON.stringify({ error: "Failed to retrieve email settings", details: settingsError }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailSettings = settingsData?.email_settings;
    if (!emailSettings?.apiKey || !emailSettings?.domain) {
      await logDebugEvent(supabase, "error", "email_function", "Email settings not configured");
      return new Response(
        JSON.stringify({ error: "Email settings not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log attempt to send email
    await logDebugEvent(supabase, "info", "email_function", "Attempting to send email", {
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      domain: emailSettings.domain
    });

    // Prepare form data for Mailgun API
    const formData = new FormData();
    formData.append("from", `${emailSettings.fromName} <${emailSettings.fromEmail}>`);
    
    // Handle multiple recipients
    if (Array.isArray(to)) {
      to.forEach((recipient: string) => formData.append("to", recipient));
    } else {
      formData.append("to", to);
    }
    
    formData.append("subject", subject);
    
    if (html) formData.append("html", html);
    if (text) formData.append("text", text);
    
    // Add CC recipients if provided
    if (cc) {
      if (Array.isArray(cc)) {
        cc.forEach((recipient: string) => formData.append("cc", recipient));
      } else {
        formData.append("cc", cc);
      }
    }
    
    // Add BCC recipients if provided
    if (bcc) {
      if (Array.isArray(bcc)) {
        bcc.forEach((recipient: string) => formData.append("bcc", recipient));
      } else {
        formData.append("bcc", bcc);
      }
    }

    const mailgunUrl = `https://api.mailgun.net/v3/${emailSettings.domain}/messages`;
    
    // Log the API request details (excluding sensitive data)
    await logDebugEvent(supabase, "info", "email_function", "Sending request to Mailgun", {
      url: mailgunUrl,
      method: "POST",
      recipients: {
        to: Array.isArray(to) ? to.length : 1,
        cc: cc ? (Array.isArray(cc) ? cc.length : 1) : 0,
        bcc: bcc ? (Array.isArray(bcc) ? bcc.length : 1) : 0
      }
    });

    let mailgunResponse;
    try {
      // Send email via Mailgun API
      mailgunResponse = await fetch(mailgunUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`api:${emailSettings.apiKey}`)}`,
        },
        body: formData,
      });

      if (!mailgunResponse.ok) {
        const errorData = await mailgunResponse.text();
        
        // Log the error response
        await logDebugEvent(supabase, "error", "email_function", "Mailgun API error response", {
          status: mailgunResponse.status,
          statusText: mailgunResponse.statusText,
          error: errorData
        });

        // Log the failed attempt
        await supabase.from("email_logs").insert({
          to_email: Array.isArray(to) ? to.join(", ") : to,
          subject,
          status: "failed",
          response: { 
            status: mailgunResponse.status,
            statusText: mailgunResponse.statusText,
            error: errorData 
          }
        });

        return new Response(
          JSON.stringify({ 
            error: "Failed to send email", 
            status: mailgunResponse.status,
            details: errorData 
          }),
          {
            status: mailgunResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const responseData = await mailgunResponse.json();

      // Log successful email
      await supabase.from("email_logs").insert({
        to_email: Array.isArray(to) ? to.join(", ") : to,
        subject,
        status: "sent",
        response: responseData,
      });

      // Log success
      await logDebugEvent(supabase, "info", "email_function", "Email sent successfully", {
        messageId: responseData.id
      });

      return new Response(
        JSON.stringify({ success: true, message: "Email sent successfully", id: responseData.id }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    } catch (fetchError) {
      // Log the network error
      await logDebugEvent(supabase, "error", "email_function", "Mailgun API fetch error", {
        error: fetchError.message,
        stack: fetchError.stack
      });
      
      // Log the failed attempt
      await supabase.from("email_logs").insert({
        to_email: Array.isArray(to) ? to.join(", ") : to,
        subject,
        status: "failed",
        response: { error: fetchError.message, stack: fetchError.stack }
      });

      return new Response(
        JSON.stringify({ 
          error: "Failed to connect to Mailgun API", 
          details: fetchError.message,
          stack: fetchError.stack
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    // Log the error if we have a Supabase client
    if (supabase) {
      await logDebugEvent(supabase, "error", "email_function", "Internal server error", {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
    } else {
      console.error("Critical error - could not log to Supabase:", error);
    }

    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        message: error.message,
        stack: error.stack,
        name: error.name
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});