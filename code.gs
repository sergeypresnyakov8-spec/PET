/**
 * Google Apps Script Backend for PET Calculator
 * Deploy as Web App. Set access to "Anyone".
 */

function doGet(e) {
  if (e.parameter.action === 'getOptions') return handleGetOptions();
  return ContentService.createTextOutput("API running. Send POST.").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    return handleCalculate(data);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleGetOptions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("ПЭТ") || ss.getSheets()[0]; 
  let options = ["Основа ПЭТ (Прозр.)", "Основа ПЭТ (Метализ.)", "Основа ПЭТ (своя цена)"];
  let thicknessOptions = [12, 15, 19, 23, 33, 50, 75, 100];
  let defaultInputs = {};
  
  try {
    const rule = sheet.getRange("B2").getDataValidation();
    if (rule != null) {
      const criteriaType = rule.getCriteriaType();
      if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
        options = rule.getCriteriaValues()[0];
      } else if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
        options = rule.getCriteriaValues()[0].getValues().flat().filter(String);
      }
    }
    
    const ruleThick = sheet.getRange("B5").getDataValidation();
    if (ruleThick != null) {
      const criteriaType = ruleThick.getCriteriaType();
      if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
        thicknessOptions = ruleThick.getCriteriaValues()[0];
      } else if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
        thicknessOptions = ruleThick.getCriteriaValues()[0].getValues().flat().filter(String);
      }
    }

    // Read default values from the sheet
    defaultInputs = {
      basePetType: sheet.getRange("B2").getValue() || options[0],
      customPetPrice: sheet.getRange("F5").getValue() || 0,
      orderVolume: sheet.getRange("B3").getValue() || 40000,
      baseWidth: sheet.getRange("B4").getValue() || 1200,
      baseThickness: sheet.getRange("B5").getValue() || 50,
      numberOfPasses: sheet.getRange("B6").getValue() || 1,
      slitter1: sheet.getRange("B7").getValue() || false,
      slitter2: sheet.getRange("B8").getValue() || false,
      ecoFee: sheet.getRange("D7").getValue() || false,
      transportCost: sheet.getRange("D8").getValue() || 0,
      machineSpeed: sheet.getRange("B10").getValue() || 100,
      setupPct: (sheet.getRange("B11").getValue() || 0) * 100,
      wastePct: (sheet.getRange("B12").getValue() || 0) * 100,
      marginPct: (sheet.getRange("B49").getValue() || 0) * 100
    };
  } catch (e) {}
  
  return ContentService.createTextOutput(JSON.stringify({ 
    options: options, 
    thicknessOptions: thicknessOptions,
    defaultInputs: defaultInputs
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleCalculate(inputs) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const templateSheet = ss.getSheetByName("ПЭТ") || ss.getSheets()[0]; 
  const tempSheet = templateSheet.copyTo(ss);
  tempSheet.setName("Temp_Calc_" + Utilities.getUuid());
  
  try {
    if (inputs.basePetType !== undefined) tempSheet.getRange("B2").setValue(inputs.basePetType);
    if (inputs.customPetPrice !== undefined && inputs.customPetPrice > 0) tempSheet.getRange("F5").setValue(inputs.customPetPrice);
    if (inputs.orderVolume !== undefined) tempSheet.getRange("B3").setValue(inputs.orderVolume);
    if (inputs.baseWidth !== undefined) tempSheet.getRange("B4").setValue(inputs.baseWidth);
    if (inputs.baseThickness !== undefined) tempSheet.getRange("B5").setValue(inputs.baseThickness);
    if (inputs.numberOfPasses !== undefined) tempSheet.getRange("B6").setValue(inputs.numberOfPasses);
    if (inputs.slitter1 !== undefined) tempSheet.getRange("B7").setValue(inputs.slitter1);
    if (inputs.slitter2 !== undefined) tempSheet.getRange("B8").setValue(inputs.slitter2);
    if (inputs.ecoFee !== undefined) tempSheet.getRange("D7").setValue(inputs.ecoFee);
    if (inputs.transportCost !== undefined) tempSheet.getRange("D8").setValue(inputs.transportCost);
    if (inputs.machineSpeed !== undefined) tempSheet.getRange("B10").setValue(inputs.machineSpeed);
    if (inputs.setupPct !== undefined) tempSheet.getRange("B11").setValue(inputs.setupPct / 100);
    if (inputs.wastePct !== undefined) tempSheet.getRange("B12").setValue(inputs.wastePct / 100);
    if (inputs.marginPct !== undefined) tempSheet.getRange("B49").setValue(inputs.marginPct / 100);
    
    SpreadsheetApp.flush();
    
    const mainTotalsPlanned = tempSheet.getRange("C42:E42").getValues()[0];
    const mainTotalsCustomer = tempSheet.getRange("C50:E50").getValues()[0];
    const breakdownRange = tempSheet.getRange("A15:G41").getValues();
    const breakdown = breakdownRange.map(row => ({
      expense: row[0], orderCost: row[1], costPerM2: row[3], costPerKg: row[4], pct: row[5], note: row[6] || row[2] || ""
    })).filter(row => {
      // Filter out empty rows, header rows, and sub-table headers
      if (!row.expense || row.expense === "" || row.expense === "Расход") return false;
      if (row.expense === "наименование" || row.expense === "Поддон, шт" || row.expense === "Гофрокартон, шт" || 
          row.expense === "Гофрокороб 400*400*400мм, шт" || row.expense === "Скотч, шт" || 
          row.expense === "Лента ПП 15х0,8х2 км (210 кгс) серый, м.п." || row.expense === "Шпули (втулки), шт" || 
          row.expense === "Заглушки для шпули" || row.expense === "Плёнка упаковочная" || 
          row.expense === "Стретч, шт" || row.expense === "Фанера или ДСП, шт" || 
          row.expense === "Крышка поддона, шт") return false;
      
      // Only include rows that have a percentage value (which indicates it's a main expense category)
      // or specific known categories
      return row.pct !== "" && row.pct !== undefined;
    }); 
    
    const techStats = tempSheet.getRange("D3:D6").getValues().map(r => r[0]);
    
    const result = {
      totals: {
        planned: { order: mainTotalsPlanned[0] || 0, m2: mainTotalsPlanned[1] || 0, kg: mainTotalsPlanned[2] || 0 },
        customer: { order: mainTotalsCustomer[0] || 0, m2: mainTotalsCustomer[1] || 0, kg: mainTotalsCustomer[2] || 0 }
      },
      breakdown: breakdown,
      techStats: { weight: techStats[0] || 0, length: techStats[1] || 0, m2Weight: techStats[2] || 0, m2PerKg: techStats[3] || 0 }
    };
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } finally {
    ss.deleteSheet(tempSheet);
  }
}
