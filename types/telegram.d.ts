interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  BackButton: { isVisible: boolean; onClick: (fn: () => void) => void; offClick: (fn: () => void) => void; show: () => void; hide: () => void };
  MainButton: { text: string; color: string; textColor: string; isVisible: boolean; isActive: boolean; isProgressVisible: boolean; setText: (text: string) => void; onClick: (fn: () => void) => void; offClick: (fn: () => void) => void; show: () => void; hide: () => void; enable: () => void; disable: () => void; showProgress: (leaveActive: boolean) => void; hideProgress: () => void };
  HapticFeedback: { impactOccurred: (style: string) => void; notificationOccurred: (type: string) => void; selectionChanged: () => void };
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  onEvent: (eventType: string, eventHandler: () => void) => void;
  offEvent: (eventType: string, eventHandler: () => void) => void;
  sendData: (data: string) => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type: string; text?: string }> }, callback?: (id: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
}

interface AdsgramShowResult {
  done: boolean;
  description: string;
  state: string;
  error?: boolean;
}

interface AdsgramController {
  show: () => Promise<AdsgramShowResult>;
  destroy: () => void;
}

interface Window {
  Telegram: {
    WebApp: TelegramWebApp;
  };
  Adsgram?: {
    init: (params: { blockId: string; debug?: boolean; debugBannerType?: string }) => AdsgramController;
  };
  show_11196790?: () => void;
  showGiga?: () => Promise<{ success?: boolean }>;
  __hive_home_ad_callback?: () => void;
}
