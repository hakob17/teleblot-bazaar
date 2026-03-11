import crypto from 'crypto';

/**
 * Validates the initData string received from Telegram Web App
 * @param initData The raw initData string
 * @param botToken The bot token used for validation
 * @returns boolean
 */
export function validateTelegramWebAppData(initData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      return false;
    }

    urlParams.delete('hash');
    // Sort keys alphabetically
    const keys = Array.from(urlParams.keys()).sort();
    
    const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');
    
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Error validating Telegram data:', error);
    return false;
  }
}

/**
 * Parses the user object from the initData string
 */
export function parseTelegramUser(initData: string): any {
  const urlParams = new URLSearchParams(initData);
  const userStr = urlParams.get('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }
  return null;
}
