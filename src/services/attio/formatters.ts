export interface ForwardedMessageData {
  text: string;
  senderUsername?: string;
  senderFirstName?: string;
  senderLastName?: string;
  chatName: string;
  date: number;
  messageId: number;
  hasMedia?: boolean;
  mediaType?: string;
}

export function formatMessageForAttio(data: ForwardedMessageData): { title: string; content: string } {
  const date = new Date(data.date * 1000);
  const formattedDate = date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const sender = data.senderUsername 
    ? `@${data.senderUsername}`
    : [data.senderFirstName, data.senderLastName].filter(Boolean).join(" ") || "Unknown";

  const title = `Message from ${data.chatName} - ${formattedDate}`;

  let content = `**Forwarded from:** ${data.chatName}\n`;
  content += `**Sender:** ${sender}\n`;
  content += `**Date:** ${formattedDate}\n`;
  
  if (data.hasMedia && data.mediaType) {
    content += `**Media:** ${data.mediaType}\n`;
  }
  
  content += `\n---\n\n`;
  
  if (data.text) {
    content += data.text;
  } else if (data.hasMedia) {
    content += `[${data.mediaType} message]`;
  } else {
    content += "[No text content]";
  }

  return { title, content };
}

export function formatLocationString(company: { location?: string }): string | undefined {
  return company.location;
}

export function formatMessagesForSingleNote(messages: ForwardedMessageData[]): { title: string; content: string } {
  const now = new Date();
  const formattedDate = now.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Get the first message's chat name for the title
  const chatName = messages.length > 0 ? messages[0].chatName : "Unknown";
  const title = `Telegram conversation with ${chatName} - ${formattedDate}`;

  let content = '';

  messages.forEach((data, index) => {
    const date = new Date(data.date * 1000);
    const timeOnly = date.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const sender = data.senderUsername 
      ? `@${data.senderUsername}`
      : [data.senderFirstName, data.senderLastName].filter(Boolean).join(" ") || "Unknown";

    // Format like a chat message: [Time] Sender: Message
    content += `**[${timeOnly}] ${sender}:**\n`;
    
    if (data.text) {
      content += `${data.text}\n`;
    } else if (data.hasMedia && data.mediaType) {
      content += `*[sent a ${data.mediaType}]*\n`;
    } else {
      content += `*[empty message]*\n`;
    }

    // Add spacing between messages
    if (index < messages.length - 1) {
      content += `\n`;
    }
  });

  return { title, content };
}
