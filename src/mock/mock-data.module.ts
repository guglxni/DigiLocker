import { Module } from '@nestjs/common';
import { MockDataService } from './mock-data.service';

@Module({
  providers: [MockDataService],
  exports: [MockDataService],
})
export class MockDataModule {}
