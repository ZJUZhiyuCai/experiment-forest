import { ExperimentDataStandard, DataValidationRule, ExperimentCategory, ExperimentRecord } from '@/types';

/**
 * 生命医药领域实验数据标准化规范
 */
export const experimentDataStandards: ExperimentDataStandard[] = [
  {
    category: 'cell_culture',
    requiredFields: ['title', 'date', 'sampleType', 'methodology'],
    validationRules: [
      {
        field: 'sampleSize',
        type: 'range',
        value: { min: 1, max: 1000000 },
        message: '细胞数量应在1-1000000之间'
      },
      {
        field: 'experimentalConditions.temperature',
        type: 'range',
        value: { min: 4, max: 42 },
        message: '培养温度应在4-42°C之间'
      }
    ],
    dataFormat: {
      units: {
        temperature: '°C',
        humidity: '%',
        co2: '%',
        cellDensity: 'cells/mL'
      },
      ranges: {
        temperature: { min: 4, max: 42 },
        humidity: { min: 30, max: 95 },
        co2: { min: 0, max: 20 }
      }
    }
  },

  {
    category: 'pcr',
    requiredFields: ['title', 'date', 'methodology', 'equipment'],
    validationRules: [
      {
        field: 'experimentalConditions.temperature',
        type: 'range',
        value: { min: 4, max: 100 },
        message: 'PCR温度应在4-100°C之间'
      },
      {
        field: 'qualityControl.replicates',
        type: 'range',
        value: { min: 1, max: 10 },
        message: '重复次数应在1-10次之间'
      }
    ],
    dataFormat: {
      units: {
        temperature: '°C',
        time: 'seconds',
        concentration: 'μM'
      },
      ranges: {
        denatureTemp: { min: 94, max: 98 },
        annealingTemp: { min: 45, max: 72 },
        extensionTemp: { min: 68, max: 72 }
      }
    }
  },

  {
    category: 'western_blot',
    requiredFields: ['title', 'date', 'sampleType', 'reagents'],
    validationRules: [
      {
        field: 'sampleSize',
        type: 'range',
        value: { min: 1, max: 500 },
        message: '蛋白浓度应在1-500μg之间'
      }
    ],
    dataFormat: {
      units: {
        concentration: 'μg/μL',
        voltage: 'V',
        time: 'minutes'
      },
      ranges: {
        proteinConc: { min: 0.1, max: 10 },
        voltage: { min: 50, max: 200 }
      }
    }
  },

  {
    category: 'elisa',
    requiredFields: ['title', 'date', 'sampleType', 'methodology'],
    validationRules: [
      {
        field: 'experimentalConditions.temperature',
        type: 'range',
        value: { min: 4, max: 37 },
        message: 'ELISA孵育温度应在4-37°C之间'
      },
      {
        field: 'qualityControl.replicates',
        type: 'range',
        value: { min: 2, max: 6 },
        message: 'ELISA重复孔数应在2-6个之间'
      }
    ],
    dataFormat: {
      units: {
        concentration: 'pg/mL',
        temperature: '°C',
        time: 'minutes',
        od: 'OD450'
      },
      ranges: {
        temperature: { min: 4, max: 37 },
        incubationTime: { min: 15, max: 180 }
      }
    }
  },

  {
    category: 'animal_dosing',
    requiredFields: ['title', 'date', 'sampleType', 'methodology', 'qualityControl'],
    validationRules: [
      {
        field: 'sampleSize',
        type: 'range',
        value: { min: 1, max: 100 },
        message: '动物数量应在1-100只之间'
      },
      {
        field: 'qualityControl.replicates',
        type: 'range',
        value: { min: 3, max: 20 },
        message: '每组动物数应在3-20只之间'
      }
    ],
    dataFormat: {
      units: {
        weight: 'g',
        dose: 'mg/kg',
        volume: 'mL'
      },
      ranges: {
        mouseWeight: { min: 15, max: 40 },
        ratWeight: { min: 150, max: 500 }
      }
    }
  }
];

/**
 * 获取实验类型的数据标准
 */
export function getDataStandardByCategory(category: ExperimentCategory): ExperimentDataStandard | undefined {
  return experimentDataStandards.find(standard => standard.category === category);
}

/**
 * 验证实验记录数据
 */
export function validateExperimentData(record: Partial<ExperimentRecord>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!record.category) {
    errors.push('实验类型不能为空');
    return { isValid: false, errors };
  }

  const standard = getDataStandardByCategory(record.category);
  if (!standard) {
    return { isValid: true, errors: [] }; // 没有标准则通过验证
  }

  // 检查必填字段
  for (const field of standard.requiredFields) {
    if (!getNestedValue(record, field)) {
      errors.push(`${getFieldDisplayName(field)}是必填字段`);
    }
  }

  // 执行验证规则
  for (const rule of standard.validationRules) {
    const value = getNestedValue(record, rule.field);
    if (value !== undefined && value !== null) {
      const validationResult = validateField(value, rule);
      if (!validationResult) {
        errors.push(rule.message);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 验证单个字段
 */
function validateField(value: any, rule: DataValidationRule): boolean {
  switch (rule.type) {
    case 'required':
      return value !== undefined && value !== null && value !== '';
    
    case 'numeric':
      return !isNaN(Number(value));
    
    case 'range':
      const numValue = Number(value);
      if (isNaN(numValue)) return false;
      const { min, max } = rule.value;
      return numValue >= min && numValue <= max;
    
    case 'pattern':
      const regex = new RegExp(rule.value);
      return regex.test(String(value));
    
    default:
      return true;
  }
}

/**
 * 获取嵌套对象的值
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * 获取字段显示名称
 */
function getFieldDisplayName(field: string): string {
  const fieldNames: { [key: string]: string } = {
    'title': '实验标题',
    'date': '实验日期',
    'sampleType': '样本类型',
    'methodology': '实验方法',
    'equipment': '使用设备',
    'reagents': '试剂信息',
    'sampleSize': '样本数量',
    'experimentalConditions.temperature': '实验温度',
    'experimentalConditions.humidity': '湿度',
    'experimentalConditions.ph': 'pH值',
    'qualityControl.replicates': '重复次数',
    'qualityControl.controls': '对照组',
    'qualityControl.randomization': '随机化'
  };
  
  return fieldNames[field] || field;
}

/**
 * 格式化实验数据
 */
export function formatExperimentData(record: Partial<ExperimentRecord>): Partial<ExperimentRecord> {
  if (!record.category) return record;

  const standard = getDataStandardByCategory(record.category);
  if (!standard) return record;

  const formatted = { ...record };

  // 应用数据格式化
  if (standard.dataFormat.units && formatted.experimentalConditions) {
    Object.keys(standard.dataFormat.units).forEach(key => {
      if (formatted.experimentalConditions?.[key] !== undefined) {
        // 确保数值格式正确
        const value = formatted.experimentalConditions[key];
        if (!isNaN(Number(value))) {
          formatted.experimentalConditions[key] = Number(value);
        }
      }
    });
  }

  return formatted;
}

/**
 * 生成实验数据模板
 */
export function generateExperimentTemplate(category: ExperimentCategory): Partial<ExperimentRecord> {
  const standard = getDataStandardByCategory(category);
  if (!standard) return {};

  const template: Partial<ExperimentRecord> = {
    category,
    experimentalConditions: {},
    qualityControl: {
      controls: [],
      replicates: 3,
      randomization: true
    },
    dataValidation: {
      isValidated: false
    }
  };

  // 根据标准设置默认值
  if (standard.dataFormat.units) {
    Object.keys(standard.dataFormat.units).forEach(key => {
      if (template.experimentalConditions) {
        template.experimentalConditions[key] = '';
      }
    });
  }

  return template;
}

/**
 * 获取实验类型的中文显示名称
 */
export function getExperimentCategoryDisplayName(category: ExperimentCategory): string {
  const categoryNames: { [key in ExperimentCategory]: string } = {
    'cell_culture': '细胞培养',
    'cell_viability': '细胞活力检测',
    'flow_cytometry': '流式细胞术',
    'cell_transfection': '细胞转染',
    'pcr': 'PCR扩增',
    'western_blot': 'Western Blot',
    'gene_cloning': '基因克隆',
    'dna_sequencing': 'DNA测序',
    'rna_extraction': 'RNA提取',
    'protein_purification': '蛋白质纯化',
    'animal_behavior': '动物行为学',
    'animal_surgery': '动物手术',
    'animal_dosing': '动物给药',
    'tissue_sampling': '组织取样',
    'drug_screening': '药物筛选',
    'compound_synthesis': '化合物合成',
    'pharmacokinetics': '药代动力学',
    'toxicology': '毒理学研究',
    'dose_response': '剂量-反应研究',
    'elisa': 'ELISA检测',
    'chromatography': '色谱分析',
    'mass_spectrometry': '质谱分析',
    'immunohistochemistry': '免疫组化',
    'bacterial_culture': '细菌培养',
    'antimicrobial_test': '抗菌试验',
    'sterility_test': '无菌检验',
    'other': '其他'
  };
  
  return categoryNames[category] || category;
}

/**
 * 按分类组织实验类型
 */
export function getExperimentCategoriesByGroup(): { [group: string]: { category: ExperimentCategory; name: string }[] } {
  return {
    '细胞生物学': [
      { category: 'cell_culture', name: '细胞培养' },
      { category: 'cell_viability', name: '细胞活力检测' },
      { category: 'flow_cytometry', name: '流式细胞术' },
      { category: 'cell_transfection', name: '细胞转染' }
    ],
    '分子生物学': [
      { category: 'pcr', name: 'PCR扩增' },
      { category: 'western_blot', name: 'Western Blot' },
      { category: 'gene_cloning', name: '基因克隆' },
      { category: 'dna_sequencing', name: 'DNA测序' },
      { category: 'rna_extraction', name: 'RNA提取' },
      { category: 'protein_purification', name: '蛋白质纯化' }
    ],
    '动物实验': [
      { category: 'animal_behavior', name: '动物行为学' },
      { category: 'animal_surgery', name: '动物手术' },
      { category: 'animal_dosing', name: '动物给药' },
      { category: 'tissue_sampling', name: '组织取样' }
    ],
    '药物研发': [
      { category: 'drug_screening', name: '药物筛选' },
      { category: 'compound_synthesis', name: '化合物合成' },
      { category: 'pharmacokinetics', name: '药代动力学' },
      { category: 'toxicology', name: '毒理学研究' },
      { category: 'dose_response', name: '剂量-反应研究' }
    ],
    '生化分析': [
      { category: 'elisa', name: 'ELISA检测' },
      { category: 'chromatography', name: '色谱分析' },
      { category: 'mass_spectrometry', name: '质谱分析' },
      { category: 'immunohistochemistry', name: '免疫组化' }
    ],
    '微生物学': [
      { category: 'bacterial_culture', name: '细菌培养' },
      { category: 'antimicrobial_test', name: '抗菌试验' },
      { category: 'sterility_test', name: '无菌检验' }
    ],
    '其他': [
      { category: 'other', name: '其他实验' }
    ]
  };
}