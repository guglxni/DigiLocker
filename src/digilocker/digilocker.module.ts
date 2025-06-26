import { Module } from '@nestjs/common';
import { DigilockerService } from './digilocker.service';
import { HttpModule } from '@nestjs/axios'; // Required for DigilockerService
import { DigilockerController } from './digilocker.controller'; // Import controller
import { MockDataModule } from '../mock/mock-data.module'; // Import MockDataModule

@Module({
  imports: [
    HttpModule,
    MockDataModule, // Add MockDataModule for DigilockerService's mock fallback
  ],
  providers: [DigilockerService],
  exports: [DigilockerService],
  controllers: [DigilockerController], // Add controller
})
export class DigilockerModule {}
