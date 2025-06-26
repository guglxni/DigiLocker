import { Controller, Get, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  @Get()
  serveDashboard(@Res() res: Response) {
    // Log current working directory and other helpful information
    this.logger.log(`Current working directory: ${process.cwd()}`);
    this.logger.log(`__dirname: ${__dirname}`);

    const possiblePaths = [
      path.resolve(process.cwd(), 'dist', 'src', 'dashboard', 'dashboard.html'),
      path.resolve(process.cwd(), 'src', 'dashboard', 'dashboard.html'),
      path.resolve(__dirname, 'dashboard.html'),
      path.resolve(__dirname, '..', '..', 'src', 'dashboard', 'dashboard.html')
    ];

    // Log all possible paths
    possiblePaths.forEach(p => {
      this.logger.log(`Checking path: ${p}`);
      this.logger.log(`Path exists: ${fs.existsSync(p)}`);
    });

    const dashboardPath = possiblePaths.find(p => fs.existsSync(p));

    if (dashboardPath) {
      this.logger.log(`Serving dashboard from: ${dashboardPath}`);
      res.sendFile(dashboardPath);
    } else {
      this.logger.error('Dashboard HTML file not found');
      res.status(404).send('Dashboard HTML not found. Checked paths: ' + possiblePaths.join(', '));
    }
  }

  @ApiExcludeEndpoint()
  @Public()
  @Get('files')
  serveFilesDashboard(@Res() res: Response) {
    this.logger.log('Serving files dashboard page');
    
    // This HTML will be served directly
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DigiLocker Files Dashboard</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            h1 {
                color: #3563e9;
            }
            .file-list {
                margin-top: 20px;
            }
            .file-item {
                padding: 10px;
                margin-bottom: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            .file-name {
                font-weight: bold;
            }
            .file-info {
                color: #666;
                font-size: 0.9em;
            }
            .btn {
                display: inline-block;
                padding: 8px 12px;
                margin-right: 10px;
                background-color: #3563e9;
                color: white;
                border-radius: 4px;
                text-decoration: none;
                font-size: 14px;
                cursor: pointer;
            }
            .btn-secondary {
                background-color: #f1f5f9;
                color: #333;
            }
            .user-info {
                margin-bottom: 20px;
                padding: 15px;
                background-color: #f8fafc;
                border-radius: 4px;
            }
        </style>
    </head>
    <body>
        <div class="user-info">
            <h2>User Profile</h2>
            <p id="user-name">Loading user information...</p>
            <p id="user-email"></p>
            <button onclick="logout()" class="btn">Logout</button>
        </div>

        <h1>My DigiLocker Documents</h1>
        
        <div class="file-list" id="file-list">
            <p>Loading documents...</p>
        </div>

        <script>
            document.addEventListener('DOMContentLoaded', function() {
                // Check if user is authenticated
                const accessToken = localStorage.getItem('accessToken');
                if (!accessToken) {
                    window.location.href = '/auth/login-page';
                    return;
                }
                
                // Load user info
                loadUserInfo();
                
                // Load files
                loadFiles();
            });
            
            function loadUserInfo() {
                const accessToken = localStorage.getItem('accessToken');
                
                fetch('http://localhost:3007/auth/user', {
                    headers: {
                        'Authorization': \`Bearer \${accessToken}\`
                    }
                })
                .then(res => {
                    if (!res.ok) {
                        throw new Error(\`HTTP error! status: \${res.status}\`);
                    }
                    return res.json();
                })
                .then(data => {
                    document.getElementById('user-name').textContent = data.name || 'User Name';
                    document.getElementById('user-email').textContent = data.email || 'user@example.com';
                })
                .catch(err => {
                    console.error('Error fetching user info:', err);
                    document.getElementById('user-name').textContent = 'Authentication Error';
                    document.getElementById('user-email').textContent = 'Please try logging in again';
                });
            }
            
            function loadFiles() {
                // Mock file data for demonstration
                const files = [
                    { id: 1, name: "Aadhaar Card", type: "PDF", issuer: "UIDAI", date: "2022-05-15" },
                    { id: 2, name: "PAN Card", type: "PDF", issuer: "Income Tax Dept", date: "2021-03-10" },
                    { id: 3, name: "Driving License", type: "PDF", issuer: "RTO", date: "2020-11-22" },
                    { id: 4, name: "Vaccination Certificate", type: "PDF", issuer: "Ministry of Health", date: "2023-01-05" }
                ];
                
                const fileList = document.getElementById('file-list');
                fileList.innerHTML = '';
                
                files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.innerHTML = \`
                        <div class="file-name">\${file.name}</div>
                        <div class="file-info">
                            Type: \${file.type} | Issuer: \${file.issuer} | Date: \${file.date}
                        </div>
                        <div style="margin-top: 10px;">
                            <a href="#" class="btn" onclick="viewFile(\${file.id})">View</a>
                            <a href="#" class="btn btn-secondary" onclick="downloadFile(\${file.id})">Download</a>
                        </div>
                    \`;
                    fileList.appendChild(fileItem);
                });
            }
            
            function viewFile(fileId) {
                alert('Viewing file ID: ' + fileId);
                // In a real app, this would open the file viewer
            }
            
            function downloadFile(fileId) {
                alert('Downloading file ID: ' + fileId);
                // In a real app, this would download the file
            }
            
            function logout() {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                window.location.href = '/auth/login-page';
            }
        </script>
    </body>
    </html>
    `;
    
    // Set content type to HTML and send the response
    res.set('Content-Type', 'text/html');
    return res.send(html);
  }
} 