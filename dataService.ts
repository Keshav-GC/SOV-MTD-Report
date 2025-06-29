
import type { RawDataRow, PivotedData, TableHeaders, TableRow, SovType, TableRowData } from './types';
import { SovType as SovTypeEnum } from './types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Use the live Google Sheet URL for fetching data.
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRGeb21fuLgx3bUPZr2IXBocdbR4Co0S6GcKlb0GDk5aIYPt-e55C5307txc7m3-f_lgVqQTZMITArb/pub?gid=0&single=true&output=csv';

const BRANDS_TO_CLUB: { [key: string]: string } = {
  "Modern": "BIN",
  "Baker's Loaf": "BIN",
  "Harvest Gold": "BIN"
};

// Define the specific list of brands to display in the dashboard, in the desired order.
const VISIBLE_BRANDS = [
    'BIN',
    'Britannia',
    'Bonn',
    'English Oven',
    'The Health Factory',
    'Protein Chef',
    'The Baker\'s Dozen'
];

const parseImpressions = (value: string): number => {
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
};

const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parseMonthYearToDate = (monthStr: string): Date => {
    const [monthName, yearStr] = monthStr.split("'");
    const monthIndex = monthOrder.findIndex(m => monthName.startsWith(m));
    const year = parseInt(`20${yearStr}`, 10);
    if (monthIndex === -1 || isNaN(year)) {
        return new Date(0); 
    }
    return new Date(year, monthIndex, 1);
};


const processData = (
    rawData: RawDataRow[],
    selectedCategories: string[]
): PivotedData => {
    // 1. Filter out malformed rows, then filter by category and club brands
    const cleanedData = rawData
    .filter(row => row && ((row.CRAWL_MONTH && row.SLOT) || row.CRAWL_MONTH_SLOT))
    .map(row => {
        const brand = BRANDS_TO_CLUB[row.BRAND] || row.BRAND;
        let month: string;
        let slot: string;

        if (row.CRAWL_MONTH && row.SLOT) {
            month = row.CRAWL_MONTH.replace('-', "'");
            const slotName = row.SLOT.split(/_|\s/)[0]; // Handles "Evening_Slot" and "Evening Slot"
            slot = `${slotName} SOV`;
        } else if (row.CRAWL_MONTH_SLOT) {
            const [monthStr, ...slotParts] = row.CRAWL_MONTH_SLOT.split('_');
            month = monthStr ? monthStr.replace('-', "'") : 'Unknown';
            const slotName = slotParts.length > 0 ? slotParts[0] : 'Unknown';
            slot = `${slotName} SOV`;
        } else {
            month = 'Unknown';
            slot = 'Unknown SOV';
        }

        return {
            platform: row.GC_PLATFORM,
            city: row.CITY,
            category: row.CATEGORY,
            month,
            slot,
            brand,
            total: parseImpressions(row.TOTAL_IMPRESSIONS),
            ad: parseImpressions(row.AD_IMPRESSIONS),
            organic: parseImpressions(row.ORGANIC_IMPRESSIONS)
        };
    }).filter(row => selectedCategories.includes(row.category));
    
    if (cleanedData.length === 0) {
        return { headers: { months: [], allBrands: [] }, rows: [] };
    }

    // 2. Aggregate impressions by group. This uses ALL brands to ensure accurate total calculations for SOV.
    type AggregatedImpressions = { [brand: string]: { total: number; ad: number; organic: number } };
    const groupImpressions: { [key: string]: AggregatedImpressions } = {};
    const groupTotals: { [key: string]: { total: number; ad: number; organic: number } } = {};

    cleanedData.forEach(row => {
        const key = `${row.platform}|${row.city}|${row.month}|${row.slot}`;
        
        if (!groupImpressions[key]) groupImpressions[key] = {};
        if (!groupImpressions[key][row.brand]) groupImpressions[key][row.brand] = { total: 0, ad: 0, organic: 0 };
        
        if (!groupTotals[key]) groupTotals[key] = { total: 0, ad: 0, organic: 0 };
        
        groupImpressions[key][row.brand].total += row.total;
        groupImpressions[key][row.brand].ad += row.ad;
        groupImpressions[key][row.brand].organic += row.organic;
        
        groupTotals[key].total += row.total;
        groupTotals[key].ad += row.ad;
        groupTotals[key].organic += row.organic;
    });

    // 3. Get unique dimensions and filter brands for display
    const uniqueMonths = [...new Set(cleanedData.map(r => r.month))]
        .sort((a, b) => parseMonthYearToDate(a).getTime() - parseMonthYearToDate(b).getTime());
        
    const desiredSlotOrder = ['Morning SOV', 'Evening SOV'];
    const uniqueSlots = [...new Set(cleanedData.map(r => r.slot))]
      .filter(slot => desiredSlotOrder.includes(slot))
      .sort((a, b) => desiredSlotOrder.indexOf(a) - desiredSlotOrder.indexOf(b));
      
    // Filter the brands to only those specified in VISIBLE_BRANDS that are present in the current data.
    // The order of VISIBLE_BRANDS is preserved.
    const allBrandsInData = new Set(cleanedData.map(r => r.brand));
    const uniqueBrands = VISIBLE_BRANDS.filter(brand => allBrandsInData.has(brand));
    
    const headers: TableHeaders = {
        months: uniqueMonths.map(month => ({
            name: month,
            slots: uniqueSlots.map(slot => ({
                name: slot,
                brands: uniqueBrands
            }))
        })),
        allBrands: uniqueBrands
    };

    // 4. Pre-calculate all SOV data for the visible brands
    const allSovData: { [key: string]: TableRowData } = {};
    const platformCityPairs = [...new Set(cleanedData.map(r => `${r.platform}|${r.city}`))].map(pc => {
        const [platform, city] = pc.split('|');
        return { platform, city };
    });

    platformCityPairs.forEach(({ platform, city }) => {
        const key = `${platform}|${city}`;
        allSovData[key] = {};
        uniqueMonths.forEach(month => {
            allSovData[key][month] = {};
            uniqueSlots.forEach(slot => {
                allSovData[key][month][slot] = {};
                const impressionKey = `${platform}|${city}|${month}|${slot}`;
                const impressions = groupImpressions[impressionKey] || {};
                const totals = groupTotals[impressionKey] || { total: 0, ad: 0, organic: 0 };

                uniqueBrands.forEach(brand => {
                    const brandImpressions = impressions[brand] || { total: 0, ad: 0, organic: 0 };
                    // The 'totals' denominator includes all brands, ensuring the SOV is accurate.
                    allSovData[key][month][slot][brand] = {
                        [SovTypeEnum.Overall]: totals.total > 0 ? (brandImpressions.total / totals.total) * 100 : 0,
                        [SovTypeEnum.Ad]: totals.ad > 0 ? (brandImpressions.ad / totals.ad) * 100 : 0,
                        [SovTypeEnum.Organic]: totals.organic > 0 ? (brandImpressions.organic / totals.organic) * 100 : 0,
                    };
                });
            });
        });
    });

    // 5. Sort cities based on BIN SOV for the latest month
    const latestMonth = uniqueMonths.length > 0 ? uniqueMonths[uniqueMonths.length - 1] : null;
    const uniquePlatforms = [...new Set(platformCityPairs.map(p => p.platform))].sort();
    const sortedPlatformCityPairs: { platform: string, city: string }[] = [];

    uniquePlatforms.forEach(platform => {
        const citiesForPlatform = platformCityPairs.filter(p => p.platform === platform);

        citiesForPlatform.sort((a, b) => {
            if (!latestMonth || !uniqueBrands.includes('BIN')) {
                return a.city.localeCompare(b.city); // Fallback to alphabetical sort
            }

            const getBinSov = (cityData: { platform: string, city: string }): number => {
                let totalBinSov = 0;
                const citySovData = allSovData[`${cityData.platform}|${cityData.city}`];
                if (citySovData && citySovData[latestMonth]) {
                    uniqueSlots.forEach(slot => {
                        const binData = citySovData[latestMonth]?.[slot]?.['BIN'];
                        if (binData) {
                            totalBinSov += binData[SovTypeEnum.Overall];
                        }
                    });
                }
                return totalBinSov;
            };
            // Sort descending by SOV
            return getBinSov(b) - getBinSov(a);
        });
        sortedPlatformCityPairs.push(...citiesForPlatform);
    });

    // 6. Build rows from sorted data
    let lastPlatform = "";
    const rows: TableRow[] = sortedPlatformCityPairs.map(({ platform, city }) => {
        const rowData = allSovData[`${platform}|${city}`];
        const isFirstInPlatform = platform !== lastPlatform;
        lastPlatform = platform;

        return {
            platform,
            city,
            isFirstInPlatform,
            data: rowData
        };
    });

    return { headers, rows };
};


export const fetchDataAndProcess = (selectedCategories: string[]): Promise<PivotedData & { rawData: RawDataRow[], allCategories: string[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(GOOGLE_SHEET_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results: { data: RawDataRow[] }) => {
        try {
          const rawData = results.data;
          const allCategories = [...new Set(rawData.map(r => r.CATEGORY).filter(Boolean))].sort();
          const pivotedData = processData(rawData, selectedCategories.length > 0 ? selectedCategories : allCategories);
          resolve({ ...pivotedData, rawData, allCategories });
        } catch (error) {
          reject(error);
        }
      },
      error: (error: Error) => {
        console.error("Error fetching or parsing data:", error);
        reject(error);
      },
    });
  });
};

export const downloadExcel = (pivotedData: PivotedData, sovType: SovType) => {
    const { headers, rows } = pivotedData;
    const aoa: (string | number)[][] = [];
    const merges: any[] = [];

    // Header Row 1: Months
    const monthHeader: (string | number)[] = ['', ''];
    let col = 2;
    headers.months.forEach(month => {
        let span = 0;
        month.slots.forEach(slot => {
            span += slot.brands.length;
        });
        monthHeader.push(month.name);
        for (let i = 1; i < span; i++) monthHeader.push('');
        if (span > 1) {
            merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + span - 1 } });
        }
        col += span;
    });
    aoa.push(monthHeader);

    // Header Row 2: Slots
    const slotHeader: (string | number)[] = ['', ''];
    col = 2;
    headers.months.forEach(month => {
        month.slots.forEach(slot => {
            const span = slot.brands.length;
            slotHeader.push(slot.name);
            for (let i = 1; i < span; i++) slotHeader.push('');
            if (span > 1) {
                merges.push({ s: { r: 1, c: col }, e: { r: 1, c: col + span - 1 } });
            }
            col += span;
        });
    });
    aoa.push(slotHeader);
    
    // Header Row 3: Brands
    const brandHeader = ['Platform', 'City'];
    headers.months.forEach(month => {
        month.slots.forEach(slot => {
            brandHeader.push(...slot.brands);
        });
    });
    aoa.push(brandHeader);

    // Data Rows
    rows.forEach(row => {
         const flatRow: (string | number)[] = [row.platform, row.city];
         headers.months.forEach(month => {
           month.slots.forEach(slot => {
             slot.brands.forEach(brand => {
               const value = row.data[month.name]?.[slot.name]?.[brand]?.[sovType] ?? 0;
               flatRow.push(parseFloat(value.toFixed(2)));
             });
           });
         });
        aoa.push(flatRow);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SOV Report');
    XLSX.writeFile(wb, 'Grupo_Bimbo_SOV_Report.xlsx');
};

export const downloadCsv = (rawData: RawDataRow[]) => {
    const csv = Papa.unparse(rawData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'raw_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
