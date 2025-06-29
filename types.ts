export interface RawDataRow {
  GC_PLATFORM: string;
  CITY: string;
  CRAWL_MONTH_SLOT?: string;
  CRAWL_MONTH?: string;
  SLOT?: string;
  CATEGORY: string;
  BRAND: string;
  TOTAL_IMPRESSIONS: string;
  AD_IMPRESSIONS: string;
  ORGANIC_IMPRESSIONS: string;
}

export enum SovType {
  Overall = 'Overall SOV',
  Ad = 'Ad SOV',
  Organic = 'Organic SOV',
}

export type SovValues = {
  [SovType.Overall]: number;
  [SovType.Ad]: number;
  [SovType.Organic]: number;
};

export interface TableHeaders {
  months: {
    name: string;
    slots: {
      name: string;
      brands: string[];
    }[];
  }[];
  allBrands: string[];
}

export interface TableRowData {
  [month: string]: {
    [slot: string]: {
      [brand: string]: SovValues;
    };
  };
}

export interface TableRow {
  platform: string;
  city: string;
  isFirstInPlatform: boolean;
  data: TableRowData;
}

export interface PivotedData {
  headers: TableHeaders;
  rows: TableRow[];
}