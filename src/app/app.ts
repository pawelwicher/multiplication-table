import { Component } from '@angular/core';

import { PracticeScreen } from './game/practice-screen';

@Component({
  selector: 'app-root',
  imports: [PracticeScreen],
  template: '<app-practice-screen />',
})
export class App {}
