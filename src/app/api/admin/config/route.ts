import { NextResponse } from 'next/server';
import {
  loadConfig,
  saveConfig,
  validateConfig,
  DEFAULT_CONFIG,
  clearConfigCache,
  CATEGORY_HEBREW_NAMES,
  THRESHOLD_HEBREW_NAMES,
  THRESHOLD_DESCRIPTIONS,
  type ProgressConfig,
} from '@/lib/progress-config';

/**
 * GET /api/admin/config
 * Get current configuration
 */
export async function GET() {
  try {
    const config = loadConfig();
    const validation = validateConfig(config);
    
    return NextResponse.json({
      config,
      validation,
      defaults: DEFAULT_CONFIG,
      labels: {
        categories: CATEGORY_HEBREW_NAMES,
        thresholds: THRESHOLD_HEBREW_NAMES,
        descriptions: THRESHOLD_DESCRIPTIONS,
      },
    });
  } catch (error) {
    console.error('Error loading config:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/config
 * Save new configuration
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = body.config as ProgressConfig;
    
    // Validate before saving
    const validation = validateConfig(config);
    
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid configuration',
          validation,
        },
        { status: 400 }
      );
    }
    
    // Save the configuration
    saveConfig(config);
    
    // Clear the cache so new values are used
    clearConfigCache();
    
    return NextResponse.json({
      success: true,
      config,
      validation,
      message: 'Configuration saved successfully',
    });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/config/reset
 * Reset to default configuration
 */
export async function PUT() {
  try {
    saveConfig({ ...DEFAULT_CONFIG });
    clearConfigCache();
    
    return NextResponse.json({
      success: true,
      config: DEFAULT_CONFIG,
      message: 'Configuration reset to defaults',
    });
  } catch (error) {
    console.error('Error resetting config:', error);
    return NextResponse.json(
      { error: 'Failed to reset configuration' },
      { status: 500 }
    );
  }
}
