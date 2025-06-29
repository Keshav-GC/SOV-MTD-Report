
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PivotedData, RawDataRow } from './types';
import { SovType } from './types';
import { fetchDataAndProcess, downloadExcel, downloadCsv } from './dataService';

// --- UTILITY HOOK ---
const useOnClickOutside = <T extends HTMLElement>(ref: React.RefObject<T>, handler: (event: MouseEvent | TouchEvent) => void) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};

// --- ICONS ---
const ExcelIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2">
    <path d="M15.8333 1.66666H4.16667C3.24619 1.66666 2.5 2.41285 2.5 3.33332V16.6667C2.5 17.5871 3.24619 18.3333 4.16667 18.3333H15.8333C16.7538 18.3333 17.5 17.5871 17.5 16.6667V3.33332C17.5 2.41285 16.7538 1.66666 15.8333 1.66666Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.08331 10L10.4166 13.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10.4166 10L7.08331 13.3333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2">
    <path d="M10 14.1667V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12.5 11.6667L10 14.1667L7.5 11.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.8333 1.66666H4.16667C3.24619 1.66666 2.5 2.41285 2.5 3.33332V16.6667C2.5 17.5871 3.24619 18.3333 4.16667 18.3333H15.8333C16.7538 18.3333 17.5 17.5871 17.5 16.6667V3.33332C17.5 2.41285 16.7538 1.66666 15.8333 1.66666Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
);

// --- HELPER COMPONENTS ---

interface MultiSelectDropdownProps {
  allCategories: string[];
  selectedCategories: string[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ allCategories, selectedCategories, setSelectedCategories }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(dropdownRef, () => setIsOpen(false));

  const filteredCategories = allCategories.filter(cat => cat.toLowerCase().includes(searchTerm.toLowerCase()));
  const isAllSelected = allCategories.length > 0 && selectedCategories.length === allCategories.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(allCategories);
    }
  };

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm w-full flex justify-between items-center">
        <span className="block truncate">{selectedCategories.length === 0 ? 'Select Category...' : `${selectedCategories.length} selected`}</span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute mt-1 w-full rounded-md bg-white shadow-lg z-20">
          <div className="p-2">
            <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded-md"/>
          </div>
          <ul className="max-h-60 overflow-auto">
            <li className="p-2 border-b border-gray-200">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="font-semibold text-gray-900">Select All</span>
              </label>
            </li>
            {filteredCategories.map(category => (
              <li key={category} className="text-gray-900 cursor-default select-none relative py-2 pl-3 pr-9 hover:bg-gray-100">
                 <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={selectedCategories.includes(category)} onChange={() => handleCategoryToggle(category)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span>{category}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};


const CategoryInfoModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    useOnClickOutside(modalRef, onClose);

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const rawSql = `CASE
 WHEN f.keyword IN ('millet bread', 'pita bread', 'sandwich bread', 'sub bread', 'cream bread', 'bread multigrain', 'sourdough bread', 'fruit bread', 'bread stick', 'bread loaf', 'protein bread', 'ragi bread', 'sour dough bread', 'the health factory multi protein bread') THEN 'Bread - Speciality'
 WHEN f.keyword IN ('brown bread', 'bread brown') THEN 'Brown Bread'
 WHEN f.keyword IN ('pav', 'paav', 'milk pav', 'buns and pav', 'modern pav', 'vada pav', 'wow pav', 'whole wheat pav', 'atta pav', 'pav bhaji bread', 'harvest pav', 'britannia pav', 'mumbai pav', 'zero maida pav', 'ladi pav', 'bombay pav', 'pav bread', 'wheat pav', 'pav buns', 'pav bhaji') THEN 'Pav'
 WHEN f.keyword IN ('bread wheat', 'multi grain bread', 'bread atta', 'no maida bread', 'multigrain bread', 'gluten free bread', 'whole wheat bread', 'atta bread', 'wheat bread', 'whole grain bread') THEN 'Atta/Whole Wheat Bread'
 WHEN f.keyword IN ('bread', 'breads', 'bread small', 'fresh bread', 'milk bread', 'jumbo bread', 'slice bread', 'white bread', 'healthy bread', 'vegan bread', 'high protein bread', 'breakfast bread', 'elite bread', 'whole bread', 'half bread', 'small bread') THEN 'Bread - Generic'
 WHEN f.keyword IN ('modern sandwich bread', 'harvest bread', 'modern bread', 'english oven brown bread', 'modern milk bread', 'harvest gold bread') THEN 'Bread - Branded'
 WHEN f.keyword IN ('navya bread', 'britannia bread', 'britannia milk bread', 'britannia multigrain bread', 'britannia brown bread', 'kwality bread', 'bonn brown bread', 'wibs bread', 'the health factory bread', 'suchali bread', 'bonn bread', 'amul bread', 'bakers dozen bread', 'english bread', 'id bread') THEN 'Bread - Comp.'
 WHEN f.keyword IN ('hotdog bun', 'hot dog bun') THEN 'Hot Dog'
 WHEN f.keyword IN ('footlong', 'sub footlong') THEN 'Footlong'
 WHEN f.keyword IN ('pizza base', 'wheat pizza base', 'zero maida pizza base', 'english oven pizza base', 'modern pizza base', 'the health factory zero maida pizza base') THEN 'Pizza Base'
 WHEN f.keyword IN ('kulcha', 'atta kulcha', 'kulcha bread', 'harvest kulcha') THEN 'Kulcha'
 WHEN f.keyword IN ('bun', 'danish bun', 'cream bun', 'fruit bun', 'sweet bun', 'cream buns', 'sweet buns', 'vanilla cream bun', 'wheat bun', 'english oven buns', 'bread and buns', 'buns', 'britannia bun', 'raisin bun', 'navya bun', 'bao bun') THEN 'Bun'
 WHEN f.keyword IN ('burger buns', 'burger bun', 'burger bread', 'english oven burger buns', 'atta burger buns') THEN 'Burger Bun'
 WHEN f.keyword IN ('rusk', 'garlic rusk', 'rusk toast', 'suji rusk', 'butter toast', 'healthy rusk', 'toast bread', 'cake rusk', 'toast', 'bakery rusk', 'fruit cake rusk') THEN 'Rusk'
 WHEN f.keyword IN ('garlic bread', 'bonn garlic bread', 'garlic toast', 'cheese garlic bread', 'the health factory zero maida garlic bread') THEN 'Garlic Bread'
 WHEN f.keyword IN ('cupcake', 'cupcakes') THEN 'Cupcakes'
 WHEN f.keyword IN ('muffin') THEN 'Muffins'
 WHEN f.keyword IN ('dry cake', 'christmas fruit cake') THEN 'Dry Cakes'
 WHEN f.keyword IN ('cake', 'veg cake', 'unibic cake', 'vanilla cake', 'mawa cake', 'ice cream cake', 'mother''s day cake', 'britannia cake', 'father''s day cake', 'eggless cake', 'bakery cake', 'cheesecake', 'cake mix', 'caketale', 'pastry', 'banana walnut cake', 'jar cake', 'walnut cake', 'plum cake', 'eggless cake mix', 'birthday cake', 'marble cake', 'milk cake') THEN 'Cakes - Miscellaneous'
 WHEN f.keyword = 'bread brown' THEN 'Brown Bread'
 WHEN f.keyword IN ('paratha', 'lachha paratha', 'wheat roti') THEN 'Plain Parathas & Rotis'
 ELSE 'Others'
END AS category`;

    const parseSql = () => {
        const definitions: { [key: string]: string[] } = {};
        const lines = rawSql.split('\n');
        
        lines.forEach(line => {
            const match = line.trim().match(/WHEN f\.keyword (?:IN \((.*?)\)|= '(.*?)') THEN '(.*?)'/);
            if (match) {
                const keywordsRaw = match[1] || match[2];
                const category = match[3];
                const keywords = keywordsRaw.split(',').map(k => k.trim().replace(/'/g, ''));
                
                if (!definitions[category]) {
                    definitions[category] = [];
                }
                definitions[category].push(...keywords);
            }
        });

        // Consolidate unique keywords per category
        for (const category in definitions) {
            definitions[category] = [...new Set(definitions[category])];
        }

        return definitions;
    };

    const definitions = parseSql();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-800">Category Definitions</h2>
                    <p className="text-sm text-gray-500">How keywords are grouped into categories.</p>
                </div>
                <div className="p-6 overflow-y-auto space-y-4">
                    {Object.entries(definitions).map(([category, keywords]) => (
                        <div key={category}>
                            <h3 className="font-semibold text-gray-700">{category}</h3>
                            <div className="flex flex-wrap gap-1 mt-2">
                                {keywords.map(kw => (
                                    <span key={kw} className="bg-gray-100 text-gray-700 text-xs font-mono px-2 py-1 rounded">
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

interface SovTableProps {
  pivotedData: PivotedData;
  sovType: SovType;
}

const SovTable: React.FC<SovTableProps> = ({ pivotedData, sovType }) => {
    const { headers, rows } = pivotedData;

    if (rows.length === 0) {
        return <div className="text-center py-10 bg-white rounded-lg shadow-md">No data available for the selected categories.</div>
    }

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-auto w-full border-t border-gray-200 max-h-[75vh]">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-50 sticky top-0 z-20">
                        <tr>
                            <th scope="col" rowSpan={3} className="sticky left-0 bg-gray-50 z-30 px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-32 min-w-[8rem] border-r border-b border-gray-200">Platform</th>
                            <th scope="col" rowSpan={3} className="sticky left-32 bg-gray-50 z-30 px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-40 min-w-[10rem] border-r border-b border-gray-200">City</th>
                            {headers.months.map((month, monthIndex) => (
                                <th key={month.name} colSpan={month.slots.reduce((acc, s) => acc + s.brands.length, 0)} className={`px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border-b ${monthIndex > 0 ? 'border-l-4 border-gray-400' : 'border-l border-gray-200'}`}>
                                    {month.name}
                                </th>
                            ))}
                        </tr>
                        <tr>
                            {headers.months.map((month, monthIndex) => (
                                month.slots.map((slot, slotIndex) => (
                                    <th key={`${month.name}-${slot.name}`} colSpan={slot.brands.length} className={`px-6 py-3 text-center text-xs font-semibold text-gray-500 border-b border-t border-gray-200 ${monthIndex > 0 && slotIndex === 0 ? 'border-l-4 border-gray-400' : (slotIndex > 0 ? 'border-l-2 border-gray-400' : 'border-l border-gray-200')}`}>
                                        {slot.name}
                                    </th>
                                ))
                            ))}
                        </tr>
                        <tr>
                            {headers.months.map((month, monthIndex) => (
                                month.slots.map((slot, slotIndex) => (
                                    slot.brands.map((brand, brandIndex) => {
                                        let borderClass = 'border-l border-gray-200';
                                        if (monthIndex > 0 && slotIndex === 0 && brandIndex === 0) {
                                            borderClass = 'border-l-4 border-gray-400';
                                        } else if (slotIndex > 0 && brandIndex === 0) {
                                            borderClass = 'border-l-2 border-gray-400';
                                        }
                                        return (
                                            <th key={`${month.name}-${slot.name}-${brand}`} scope="col" className={`px-4 py-3 text-center text-xs font-medium text-gray-500 border-t border-b border-gray-200 w-28 ${borderClass}`}>
                                                {brand}
                                            </th>
                                        );
                                    })
                                ))
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {rows.map((row, rowIndex) => {
                            const isInstamart = row.platform.toLowerCase() === 'instamart';
                            const platformBgClass = isInstamart ? 'bg-sky-50' : 'bg-white';
                            const platformHoverBgClass = isInstamart ? 'hover:bg-sky-100' : 'hover:bg-gray-50';

                            return (
                                <tr key={`${row.platform}-${row.city}`} className={`${platformBgClass} ${platformHoverBgClass} ${row.isFirstInPlatform && rowIndex > 0 ? 'border-t-4 border-t-gray-400' : ''}`}>
                                    <td className={`sticky left-0 z-10 px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 w-32 min-w-[8rem] border-r border-gray-200 ${platformBgClass} ${platformHoverBgClass}`}>{row.platform}</td>
                                    <td className={`sticky left-32 z-10 px-6 py-4 whitespace-nowrap text-sm text-gray-500 w-40 min-w-[10rem] border-r border-gray-200 ${platformBgClass} ${platformHoverBgClass}`}>{row.city}</td>
                                    {headers.months.map((month, monthIndex) => (
                                        month.slots.map((slot, slotIndex) => (
                                            slot.brands.map((brand, brandIndex) => {
                                                let borderClass = 'border-l border-gray-200';
                                                if (monthIndex > 0 && slotIndex === 0 && brandIndex === 0) {
                                                    borderClass = 'border-l-4 border-gray-400';
                                                } else if (slotIndex > 0 && brandIndex === 0) {
                                                    borderClass = 'border-l-2 border-gray-400';
                                                }
                                                const sovData = row.data[month.name]?.[slot.name]?.[brand];
                                                
                                                if (sovData === undefined) {
                                                    return <td key={`${month.name}-${slot.name}-${brand}`} className={`px-4 py-3 text-center text-sm text-gray-500 ${borderClass}`}>-</td>;
                                                }
                                                
                                                const value = sovData[sovType];
                                                
                                                return (
                                                    <td key={`${month.name}-${slot.name}-${brand}`} className={`px-4 py-3 text-center text-sm text-gray-700 ${borderClass}`}>
                                                        {value.toFixed(2)}%
                                                    </td>
                                                );
                                            })
                                        ))
                                    ))}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


const Dashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pivotedData, setPivotedData] = useState<PivotedData>({ headers: { months: [], allBrands:[] }, rows: [] });
    const [rawData, setRawData] = useState<RawDataRow[]>([]);
    const [allCategories, setAllCategories] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [sovType, setSovType] = useState<SovType>(SovType.Overall);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const isInitialLoad = useRef(true);

    useEffect(() => {
        setLoading(true);
        fetchDataAndProcess(selectedCategories)
            .then(data => {
                setPivotedData({ headers: data.headers, rows: data.rows });
                setRawData(data.rawData);
                setError(null);
                if (isInitialLoad.current && data.allCategories.length > 0) {
                    setAllCategories(data.allCategories);
                    setSelectedCategories(data.allCategories);
                    isInitialLoad.current = false;
                }
            })
            .catch(err => {
                console.error(err);
                setError('Failed to load and process data. Please check the data source and your network connection.');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [selectedCategories]);
    
    if (error) return <div className="text-center text-red-500 p-8">{error}</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-100 min-h-screen">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-gray-800">Grupo Bimbo SOV Dashboard</h1>
            </header>

            <main className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex flex-wrap justify-between items-start gap-6">
                       <div>
                            <h2 className="text-xl font-semibold text-gray-700">SOV Report</h2>
                            <div className="flex items-center space-x-1 p-1 bg-gray-100 rounded-full mt-4">
                                {Object.values(SovType).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setSovType(type)}
                                        className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${sovType === type ? 'bg-white text-gray-800 shadow-sm' : 'bg-transparent text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                       </div>
                       <div className="flex items-center space-x-2">
                            <button onClick={() => downloadExcel(pivotedData, sovType)} className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed" disabled={loading || pivotedData.rows.length === 0}>
                                <ExcelIcon /> Download Report
                            </button>
                            <button onClick={() => downloadCsv(rawData)} className="flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={loading || rawData.length === 0}>
                                <DownloadIcon /> Download Raw Data
                            </button>
                        </div>
                    </div>
                     <div className="mt-6 border-t pt-6">
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-md font-semibold text-gray-700">Category</h3>
                            <button onClick={() => setIsInfoModalOpen(true)} className="text-gray-400 hover:text-indigo-600 transition-colors" aria-label="Show category definitions">
                                <InfoIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="max-w-md">
                            <MultiSelectDropdown 
                               allCategories={allCategories}
                               selectedCategories={selectedCategories}
                               setSelectedCategories={setSelectedCategories}
                            />
                        </div>
                    </div>
                </div>
                {loading && isInitialLoad.current ? (
                    <div className="flex justify-center items-center py-20 bg-white rounded-lg shadow-md">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                        <p className="ml-4 text-gray-600">Loading Report...</p>
                    </div>
                ) : (
                    <SovTable pivotedData={pivotedData} sovType={sovType} />
                )}
            </main>

            {isInfoModalOpen && <CategoryInfoModal onClose={() => setIsInfoModalOpen(false)} />}
        </div>
    );
};

const LoginScreen: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
    const [accountName, setAccountName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (accountName === 'Grupobimbo' && password === 'Grupobimbo') {
            onLoginSuccess();
        } else {
            setError('Invalid credentials. Please try again.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-800">Grupo Bimbo</h1>
                    <p className="mt-2 text-gray-500">SOV Dashboard Login</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="account-name" className="sr-only">Account Name</label>
                            <input
                                id="account-name"
                                name="accountName"
                                type="text"
                                autoComplete="username"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                placeholder="Account Name"
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="mt-4 text-center text-sm text-red-600">{error}</p>
                    )}

                    <div>
                        <button
                            type="submit"
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mt-6"
                        >
                            Sign in
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return <Dashboard />;
};

export default App;
