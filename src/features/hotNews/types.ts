export interface NewsItem {
  title: string;
  url: string;
  comment: string;
}

export interface NewsSection {
  source: string;
  icon: string;
  items: NewsItem[];
}

export interface DailyNews {
  date: string;
  sections: NewsSection[];
}
