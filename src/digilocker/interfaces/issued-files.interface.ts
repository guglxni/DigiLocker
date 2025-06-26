import { ApiProperty } from '@nestjs/swagger';

export class DigiLockerIssuedFile {
  @ApiProperty({ description: 'Name of the issued document (e.g., "Driving License")', example: 'Driving License' })
  name: string; // Name of the issued document (e.g., "Driving License")

  @ApiProperty({ description: 'Document type (e.g., "ड्राइविंग लाइसेंस") - often in regional language', example: 'ड्राइविंग लाइसेंस' })
  type: string; // Document type (e.g., "ड्राइविंग लाइसेंस") - often in regional language

  @ApiProperty({ description: 'File size (e.g., "61048")', example: '61048' })
  size: string; // File size (e.g., "61048")

  @ApiProperty({ description: 'Date of issuance or last update (e.g., "01-01-2020")', example: '01-01-2020' })
  date: string; // Date of issuance or last update (e.g., "01-01-2020")

  @ApiProperty({ description: 'Mime type (e.g., "application/xml" or "application/pdf")', example: 'application/pdf' })
  mime: string; // Mime type (e.g., "application/xml" or "application/pdf")

  @ApiProperty({ description: 'Unique DigiLocker URI for the file (e.g., "dl:/यां जारी किये गए दस्तावेज़/MDSL/1")', example: 'dl:/यां जारी किये गए दस्तावेज़/MDSL/1' })
  uri: string; // Unique DigiLocker URI for the file (e.g., "dl:/यां जारी किये गए दस्तावेज़/MDSL/1")

  @ApiProperty({ description: 'Optional description', example: 'My Driving License Document', required: false })
  description?: string; // Optional description

  @ApiProperty({ description: 'ID of the issuer', example: 'MORTN', required: false })
  issuerid?: string; // ID of the issuer

  @ApiProperty({ description: 'Name of the issuer (e.g., "Ministry of Road Transport and Highways")', example: 'Ministry of Road Transport and Highways', required: false })
  issuer?: string; // Name of the issuer (e.g., "Ministry of Road Transport and Highways")

  @ApiProperty({ description: 'A more specific document type code (e.g., "DRIVLIC")', example: 'DRIVLIC', required: false })
  doctype?: string; // A more specific document type code (e.g., "DRIVLIC")
  // Other fields might be present depending on the API version and file type
}

export class DigiLockerIssuedFilesResponse {
  @ApiProperty({ type: () => [DigiLockerIssuedFile], description: 'List of issued documents' })
  items: DigiLockerIssuedFile[];

  @ApiProperty({ description: 'Name of the DigiLocker account holder', example: 'John Doe', required: false })
  name?: string; // Name of the DigiLocker account holder

  @ApiProperty({ description: 'Date of birth of the account holder', example: '1990-01-01', required: false })
  dob?: string; // Date of birth of the account holder

  @ApiProperty({ description: 'Gender of the account holder', example: 'Male', required: false })
  gender?: string; // Gender of the account holder
  // Other top-level fields might be present
}
