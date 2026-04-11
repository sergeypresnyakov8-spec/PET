import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calculator, Settings, Package, Ruler, Weight, 
  DollarSign, Percent, Truck, Zap, RefreshCw, 
  ChevronDown, Info, Activity, FileSpreadsheet, Layers
} from 'lucide-react';

// --- CONFIGURATION ---
// Paste your deployed Google Apps Script Web App URL here.
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwNvFDGS1tg4GCUtNHn7lb0X1Cs29L5C3XZVk1QoeRLI79Yp3HgZuFIeJOnQ7VV0q0/exec"; 

interface Inputs {
  basePetType: string;
  customPetPrice: number;
  orderVolume: number;
  baseWidth: number;
  baseThickness: number;
  numberOfPasses: number;
  slitter1: boolean;
  slitter2: boolean;
  ecoFee: boolean;
  transportCost: number;
  machineSpeed: number;
  setupPct: number;
  wastePct: number;
  marginPct: number;
}

interface BreakdownItem {
  expense: string;
  orderCost: number;
  costPerM2: number;
  costPerKg: number;
  pct: number;
  note?: string;
}

interface CalculationResult {
  totals: {
    planned: { order: number; m2: number; kg: number };
    customer: { order: number; m2: number; kg: number };
  };
  breakdown: BreakdownItem[];
  techStats: {
    weight: number;
    length: number;
    m2Weight: number;
    m2PerKg: number;
  };
}

const formatCurrency = (val: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(val);
const formatNumber = (val: number, decimals = 2) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
const formatPct = (val: number) => new Intl.NumberFormat('ru-RU', { style: 'percent', minimumFractionDigits: 1 }).format(val);

const parseNumberSafe = (val: any, isPct = false): number => {
  if (typeof val === 'number') return isPct && val > 1 ? val / 100 : val;
  if (!val) return 0;
  // Remove spaces, non-breaking spaces, and replace comma with dot
  const str = String(val).replace(/[\s\u00A0]/g, '').replace(/,/g, '.');
  let num = parseFloat(str);
  if (isNaN(num)) return 0;
  if (isPct && str.includes('%')) {
    num = num / 100;
  } else if (isPct && num > 1) {
    num = num / 100;
  }
  return num;
};

// Mock calculation to make the UI feel alive if no GAS URL is provided
const calculateMockData = (inputs: Inputs): CalculationResult => {
  const basePricePerKg = inputs.basePetType.includes('Метализ') ? 294.02 : 247.67;
  const weight = (inputs.orderVolume * inputs.baseThickness * 1.4) / 1000; 
  const orderCost = weight * basePricePerKg * (1 + inputs.marginPct / 100) + inputs.transportCost;
  
  return {
    totals: {
      planned: {
        order: orderCost / (1 + inputs.marginPct / 100),
        m2: (orderCost / (1 + inputs.marginPct / 100)) / inputs.orderVolume,
        kg: (orderCost / (1 + inputs.marginPct / 100)) / weight
      },
      customer: {
        order: orderCost,
        m2: orderCost / inputs.orderVolume,
        kg: orderCost / weight
      }
    },
    techStats: {
      weight: weight,
      length: (inputs.orderVolume / (inputs.baseWidth / 1000)),
      m2Weight: (weight / inputs.orderVolume) * 1000,
      m2PerKg: inputs.orderVolume / weight
    },
    breakdown: [
      { expense: "Основа ПЭТ", orderCost: orderCost * 0.78, costPerM2: (orderCost * 0.78)/inputs.orderVolume, costPerKg: basePricePerKg, pct: 0.782 },
      { expense: "Техотход", orderCost: orderCost * 0.016, costPerM2: 0.35, costPerKg: 4.95, pct: 0.016 },
      { expense: "Химия", orderCost: orderCost * 0.081, costPerM2: 1.81, costPerKg: 25.65, pct: 0.081 },
      { expense: "Аренда", orderCost: orderCost * 0.009, costPerM2: 0.21, costPerKg: 2.99, pct: 0.009 },
      { expense: "Электроэнергия", orderCost: orderCost * 0.017, costPerM2: 0.38, costPerKg: 5.34, pct: 0.017 },
      { expense: "ЗП производство", orderCost: orderCost * 0.033, costPerM2: 0.74, costPerKg: 10.51, pct: 0.033 },
      { expense: "ЗП администр.", orderCost: orderCost * 0.011, costPerM2: 0.25, costPerKg: 3.59, pct: 0.011 },
      { expense: "Амортизация", orderCost: orderCost * 0.004, costPerM2: 0.10, costPerKg: 1.39, pct: 0.004 },
      { expense: "ЭКОСБОР", orderCost: orderCost * 0.034, costPerM2: 0.76, costPerKg: 10.74, pct: 0.034 },
      { expense: "Упаковка", orderCost: orderCost * 0.013, costPerM2: 0.28, costPerKg: 4.01, pct: 0.013 }
    ]
  };
};

// --- COMPONENTS ---
const InputGroup = ({ label, value, onChange, suffix, icon: Icon }: any) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value?.toString() || '');

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value?.toString() || '');
    }
  }, [value, isFocused]);

  const handleChange = (e: any) => {
    const val = e.target.value;
    setLocalValue(val);
    const parsed = parseFloat(val.replace(/[\s\u00A0]/g, '').replace(/,/g, '.'));
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (val === '') {
      onChange(0);
    }
  };

  return (
    <div className="flex flex-col space-y-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="relative flex items-center">
        {Icon && <div className="absolute left-3 text-slate-400"><Icon size={16} /></div>}
        <input
          type="text"
          inputMode="decimal"
          value={isFocused ? localValue : new Intl.NumberFormat('ru-RU').format(value)}
          onChange={handleChange}
          onFocus={() => {
            setIsFocused(true);
            setLocalValue(value === 0 ? '' : value.toString());
          }}
          onBlur={() => setIsFocused(false)}
          className={`w-full bg-white border border-slate-200 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 transition-all ${Icon ? 'pl-9' : 'pl-3'} ${suffix ? 'pr-12' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 text-slate-400 text-sm font-medium">{suffix}</span>}
      </div>
    </div>
  );
};

const SliderGroup = ({ label, value, onChange, min, max, step, suffix, icon: Icon }: any) => {
  return (
    <div className="flex flex-col space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
      <div className="flex justify-between items-center">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          {Icon && <Icon size={14} className="text-blue-500" />}
          {label}
        </label>
        <span className="text-sm font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
          {new Intl.NumberFormat('ru-RU').format(value)} {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
        <span>{new Intl.NumberFormat('ru-RU').format(min)}</span>
        <span>{new Intl.NumberFormat('ru-RU').format(max)}</span>
      </div>
    </div>
  );
};

const Toggle = ({ label, checked, onChange }: any) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`${checked ? 'bg-blue-600' : 'bg-slate-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
    >
      <span className={`${checked ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
    </button>
  </div>
);

export default function App() {
  const [inputs, setInputs] = useState<Inputs>({
    basePetType: 'Основа ПЭТ (Прозрачный)',
    customPetPrice: 0,
    orderVolume: 50000,
    baseWidth: 1200,
    baseThickness: 12,
    numberOfPasses: 1,
    slitter1: true,
    slitter2: true,
    ecoFee: true,
    transportCost: 0,
    machineSpeed: 100,
    setupPct: 10,
    wastePct: 2,
    marginPct: 0
  });

  const [options, setOptions] = useState<string[]>(["Основа ПЭТ (Прозрачный)", "Основа ПЭТ (Метализированный)", "Основа ПЭТ (своя цена)"]);
  const [thicknessOptions, setThicknessOptions] = useState<number[]>([12, 15, 19, 23, 33, 50, 75, 100]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [isMachineDataOpen, setIsMachineDataOpen] = useState(false);

  // Fetch options on load
  useEffect(() => {
    if (!GAS_WEB_APP_URL) return;
    
    // Google Apps Script requires following redirects
    fetch(`${GAS_WEB_APP_URL}?action=getOptions`, {
      redirect: 'follow'
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        let currentThickOpts = [12, 15, 19, 23, 33, 50, 75, 100];
        
        if (data.options && Array.isArray(data.options)) {
          // Filter out numbers that might be returned if data validation is misconfigured
          const validOptions = data.options.filter(opt => typeof opt === 'string' && isNaN(Number(opt)));
          if (validOptions.length > 0) {
            setOptions(validOptions);
          }
        }
        if (data.thicknessOptions && Array.isArray(data.thicknessOptions)) {
          const validThickness = data.thicknessOptions.map(Number).filter(n => !isNaN(n));
          if (validThickness.length > 0) {
            currentThickOpts = validThickness;
            setThicknessOptions(validThickness);
          }
        }
        if (data.defaultInputs) {
          setInputs(prev => {
            const newInputs = { ...prev, ...data.defaultInputs };
            
            // Если в таблице стоит толщина, которой нет в выпадающем списке (например, 13),
            // мы должны принудительно добавить ее в список, иначе select ее не покажет
            const thickVal = Number(newInputs.baseThickness);
            if (!isNaN(thickVal) && !currentThickOpts.includes(thickVal)) {
              setThicknessOptions(oldOpts => {
                return Array.from(new Set([...oldOpts, thickVal])).sort((a, b) => a - b);
              });
            }
            newInputs.baseThickness = thickVal; // гарантируем, что это число
            
            // Trigger calculation with the new inputs
            performCalculation(newInputs);
            return newInputs;
          });
        }
      })
      .catch(err => console.error("Ошибка загрузки опций", err));
  }, []);

  const performCalculation = async (currentInputs: Inputs) => {
    setIsCalculating(true);
    setError(null);
    setIsDirty(false);
    
    if (!GAS_WEB_APP_URL) {
      // Mock mode
      setTimeout(() => {
        setResult(calculateMockData(currentInputs));
        setIsCalculating(false);
      }, 1500); // Simulate network delay
      return;
    }

    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify(currentInputs),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' } // GAS requires text/plain for CORS
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        // Clean up data before setting to handle formatted strings from Google Sheets
        const breakdownData = (data.breakdown || [])
          .map((item: any) => {
            let note = item.note ? String(item.note) : '';
            if (item.expense.includes('Основа ПЭТ') && currentInputs.basePetType === 'Основа ПЭТ (своя цена)') {
              note = 'Своя цена';
            }
            return {
              expense: item.expense,
              orderCost: parseNumberSafe(item.orderCost),
              costPerM2: parseNumberSafe(item.costPerM2),
              costPerKg: parseNumberSafe(item.costPerKg),
              pct: parseNumberSafe(item.pct, true),
              note: note
            };
          })
          .filter((item: any) => {
            // Hide specific expenses if they are 0
            if ((item.expense.includes('Прочие расходы') || item.expense.includes('Покраска лайнера')) && item.orderCost === 0) {
              return false;
            }
            return true;
          });

        const plannedOrderCost = parseNumberSafe(data.totals?.planned?.order) || breakdownData.reduce((sum: number, item: any) => sum + item.orderCost, 0);

        const cleanData: CalculationResult = {
          totals: {
            planned: {
              order: plannedOrderCost,
              m2: parseNumberSafe(data.totals?.planned?.m2),
              kg: parseNumberSafe(data.totals?.planned?.kg)
            },
            customer: {
              order: parseNumberSafe(data.totals?.customer?.order),
              m2: parseNumberSafe(data.totals?.customer?.m2),
              kg: parseNumberSafe(data.totals?.customer?.kg)
            }
          },
          breakdown: breakdownData,
          techStats: {
            weight: parseNumberSafe(data.techStats?.weight),
            length: parseNumberSafe(data.techStats?.length),
            m2Weight: parseNumberSafe(data.techStats?.m2Weight),
            m2PerKg: parseNumberSafe(data.techStats?.m2PerKg)
          }
        };
        setResult(cleanData);
      }
    } catch (err) {
      setError("Не удалось подключиться к серверу расчетов.");
      console.error(err);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleInputChange = (key: keyof Inputs, value: any) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Sidebar / Input Panel */}
      <aside className="w-full md:w-[380px] lg:w-[420px] xl:w-[460px] bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 overflow-y-auto shadow-sm z-10">
        <div className="p-6 border-b border-slate-200 bg-white text-slate-900">
          <div className="flex items-center gap-3 mb-2">
            <img src="/PET/logo.png" alt="Логотип" className="h-16 w-auto object-contain" />
            <h1 className="text-xl font-bold flex items-center gap-2">
              Калькулятор ПЭТ
            </h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">Расчет производственной себестоимости</p>
          {!GAS_WEB_APP_URL && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-medium border border-amber-200">
              <Activity size={12} />
              Демо-режим
            </div>
          )}
        </div>
        
        <div className="p-6 space-y-8 flex-1">
          {/* Order Data */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Package size={16} className="text-blue-600" />
              Данные заказа
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Основа ПЭТ</label>
                <div className="relative">
                  <select
                    value={inputs.basePetType}
                    onChange={e => handleInputChange('basePetType', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 pl-3 pr-10 appearance-none"
                  >
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
              
              {inputs.basePetType.includes('своя цена') && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <InputGroup 
                    label="Своя цена ПЭТ" 
                    value={inputs.customPetPrice} 
                    onChange={(v: number) => handleInputChange('customPetPrice', v)} 
                    suffix="₽/кг" 
                    icon={DollarSign} 
                  />
                </div>
              )}

              <SliderGroup label="Объем заказа" value={inputs.orderVolume} onChange={(v: number) => handleInputChange('orderVolume', v)} min={0} max={1000000} step={5000} suffix="м²" icon={Layers} />
              
              <SliderGroup label="Ширина основы" value={inputs.baseWidth} onChange={(v: number) => handleInputChange('baseWidth', v)} min={0} max={1650} step={10} suffix="мм" icon={Ruler} />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Толщина</label>
                  <div className="relative">
                    <select
                      value={inputs.baseThickness}
                      onChange={e => handleInputChange('baseThickness', Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 pl-3 pr-10 appearance-none"
                    >
                      {thicknessOptions.map(opt => <option key={opt} value={opt}>{opt} мкм</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Кол-во сторон покрытия</label>
                  <div className="relative">
                    <select
                      value={inputs.numberOfPasses}
                      onChange={e => handleInputChange('numberOfPasses', Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 pl-9 pr-10 appearance-none"
                    >
                      <option value={1}>АА-1</option>
                      <option value={2}>АА-2</option>
                    </select>
                    <RefreshCw size={16} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <ChevronDown size={16} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Machine Data */}
          <section className="space-y-4">
            <button 
              onClick={() => setIsMachineDataOpen(!isMachineDataOpen)}
              className="w-full flex items-center justify-between text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 hover:text-blue-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-blue-600" />
                Данные машины
              </div>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${isMachineDataOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isMachineDataOpen && (
              <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                <InputGroup label="Скорость работы" value={inputs.machineSpeed} onChange={(v: number) => handleInputChange('machineSpeed', v)} suffix="м/мин" icon={Zap} />
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Настройка" value={inputs.setupPct} onChange={(v: number) => handleInputChange('setupPct', v)} suffix="%" icon={Percent} />
                  <InputGroup label="Техотход" value={inputs.wastePct} onChange={(v: number) => handleInputChange('wastePct', v)} suffix="%" icon={Percent} />
                </div>
              </div>
            )}
          </section>

          {/* Options */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Settings size={16} className="text-blue-600" />
              Опции
            </h2>
            <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <Toggle label="Слиттер №1 (большие форматы)" checked={inputs.slitter1} onChange={(v: boolean) => handleInputChange('slitter1', v)} />
              <Toggle label="Слиттер №2 (малые форматы)" checked={inputs.slitter2} onChange={(v: boolean) => handleInputChange('slitter2', v)} />
              <Toggle label="Экосбор" checked={inputs.ecoFee} onChange={(v: boolean) => handleInputChange('ecoFee', v)} />
              <div className="pt-3 mt-2 border-t border-slate-200">
                <InputGroup label="Транспортные расходы" value={inputs.transportCost} onChange={(v: number) => handleInputChange('transportCost', v)} suffix="₽" icon={Truck} />
              </div>
            </div>
          </section>

          {/* Financials */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <DollarSign size={16} className="text-blue-600" />
              Финансы
            </h2>
            <div className="space-y-4">
              <InputGroup label="Маржа" value={inputs.marginPct} onChange={(v: number) => handleInputChange('marginPct', v)} suffix="%" icon={Percent} />
            </div>
          </section>
        </div>
        
        {/* Calculate Button */}
        <div className="p-6 border-t border-slate-200 bg-white sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
          <button
            onClick={() => performCalculation(inputs)}
            disabled={isCalculating}
            className={`w-full font-bold py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
              isDirty && result
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 shadow-lg ring-2 ring-amber-500 ring-offset-2'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isCalculating ? <RefreshCw className="animate-spin" size={20} /> : <Calculator size={20} />}
            {isDirty && result ? 'Пересчитать' : 'Обновить расчёт'}
          </button>
        </div>
      </aside>

      {/* Main Content / Dashboard */}
      <main className="flex-1 overflow-y-auto h-screen relative bg-slate-100/50">
        {isCalculating && (
          <div className="absolute inset-0 bg-slate-50/60 backdrop-blur-[2px] z-50 flex items-center justify-center transition-all">
            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-slate-100">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-slate-600 font-medium animate-pulse">Обработка данных...</p>
            </div>
          </div>
        )}

        <div className={`max-w-[1400px] mx-auto transition-all duration-500 ${isDirty && result ? 'opacity-60 saturate-50' : ''}`}>
          {/* Sticky Header */}
          <div className="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-md border-b border-slate-200/60 p-4 md:p-8 pb-6 shadow-sm">
            {isDirty && result && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md shadow-sm mb-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Info className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-amber-800 font-medium">Данные изменены. Нажмите «Пересчитать», чтобы обновить результаты.</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Info className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Top Row: High-impact cards (Planned Cost Only) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Layers size={64} /></div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Себестоимость за 1 м²</h3>
                <div className="text-3xl font-bold text-slate-900 mt-auto">
                  {result ? formatCurrency(result.totals.planned.m2) : '---'}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Weight size={64} /></div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Себестоимость за 1 кг</h3>
                <div className="text-3xl font-bold text-slate-900 mt-auto">
                  {result ? formatCurrency(result.totals.planned.kg) : '---'}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={64} /></div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Плановая себестоимость (Итого)</h3>
                <div className="text-3xl font-bold text-slate-900 mt-auto">
                  {result ? formatCurrency(result.totals.planned.order) : '---'}
                </div>
              </div>
            </div>

            {/* Compact Technical Summary */}
            <div className="mt-4 bg-white/80 rounded-lg border border-slate-200/80 p-4 text-base flex flex-col md:flex-row md:items-center gap-4 md:gap-8 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 font-semibold uppercase tracking-wider text-sm">
                <Activity size={16} />
                Параметры заказа
              </div>
              <div className="grid grid-cols-2 md:flex md:gap-8 gap-3 flex-1">
                <div><span className="text-slate-500">Вес:</span> <strong className="text-slate-900 text-lg">{result ? formatNumber(result.techStats.weight) : '---'} кг</strong></div>
                <div><span className="text-slate-500">Длина:</span> <strong className="text-slate-900 text-lg">{result ? formatNumber(result.techStats.length) : '---'} м</strong></div>
                <div><span className="text-slate-500">1 м² =</span> <strong className="text-slate-900 text-lg">{result ? formatNumber(result.techStats.m2Weight) : '---'} г</strong></div>
                <div><span className="text-slate-500">1 кг =</span> <strong className="text-slate-900 text-lg">{result ? formatNumber(result.techStats.m2PerKg) : '---'} м²</strong></div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8 space-y-6">
            {/* Commercial Offer (Margin Details) */}
            <div className="bg-emerald-50 rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-emerald-200 bg-emerald-100/50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                  <DollarSign className="text-emerald-600" size={20} />
                  Коммерческое предложение (с учетом маржи {inputs.marginPct}%)
                </h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-emerald-700 mb-1">Цена для заказчика за 1 м²</span>
                  <span className="text-2xl font-bold text-emerald-900">{result ? formatCurrency(result.totals.customer.m2) : '---'}</span>
                  <span className="text-xs text-emerald-600 mt-1">Маржа: {result ? formatCurrency(result.totals.customer.m2 - result.totals.planned.m2) : '---'}</span>
                </div>
                <div className="flex flex-col border-t md:border-t-0 md:border-l border-emerald-200 pt-4 md:pt-0 md:pl-6">
                  <span className="text-sm font-medium text-emerald-700 mb-1">Цена для заказчика за 1 кг</span>
                  <span className="text-2xl font-bold text-emerald-900">{result ? formatCurrency(result.totals.customer.kg) : '---'}</span>
                  <span className="text-xs text-emerald-600 mt-1">Маржа: {result ? formatCurrency(result.totals.customer.kg - result.totals.planned.kg) : '---'}</span>
                </div>
                <div className="flex flex-col border-t md:border-t-0 md:border-l border-emerald-200 pt-4 md:pt-0 md:pl-6">
                  <span className="text-sm font-medium text-emerald-700 mb-1">Итоговая стоимость заказа</span>
                  <span className="text-2xl font-bold text-emerald-900">{result ? formatCurrency(result.totals.customer.order) : '---'}</span>
                  <span className="text-xs text-emerald-600 mt-1">Итого маржа: {result ? formatCurrency(result.totals.customer.order - result.totals.planned.order) : '---'}</span>
                </div>
              </div>
            </div>

            {/* Middle Section: Cost Breakdown Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="text-slate-400" size={20} />
                Детализация затрат
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Статья расходов</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">За м²</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">За кг</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Стоимость заказа</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">%</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Примечание</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {result?.breakdown.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {item.expense}
                        {item.expense.toLowerCase().includes('отход') && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                            {inputs.wastePct}%
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 text-right">{formatCurrency(item.costPerM2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">{formatCurrency(item.costPerKg)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">{formatCurrency(item.orderCost)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {formatPct(item.pct)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 whitespace-pre-wrap min-w-[250px]">{item.note || '-'}</td>
                    </tr>
                  ))}
                  {!result && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                        Ожидание результатов расчета...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pb-8 text-center text-sm font-medium text-slate-400">
            &copy; 2026 ИПК Себестоимость ПЭТ. Designed by <span className="text-slate-500">Economist</span>.
          </div>

        </div>
        </div>
      </main>
    </div>
  );
}
