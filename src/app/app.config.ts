import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners } from '@angular/core';

// Jeden ekran, więc bez routera.
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners()],
};
