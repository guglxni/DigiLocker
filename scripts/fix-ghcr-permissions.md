# GitHub Container Registry (GHCR) Permission Fix Guide

If you're getting "denied: installation not allowed to Write organization package" errors, follow these steps:

## Step 1: Check Repository Settings

1. Go to your GitHub repository: https://github.com/guglxni/DigiLocker
2. Click on **Settings** tab
3. Scroll down to **Actions** in the left sidebar
4. Click on **General**
5. Under **Workflow permissions**, ensure:
   - ✅ "Read and write permissions" is selected, OR
   - ✅ "Read repository contents and packages permissions" is selected

## Step 2: Package Visibility Settings

1. Go to your GitHub profile: https://github.com/guglxni
2. Click on **Packages** tab
3. If you see a `digilocker` package, click on it
4. Click on **Package settings**
5. Under **Danger Zone** > **Change visibility**
6. Ensure it's set to **Public** if you want public access

## Step 3: Organization Settings (if applicable)

If your account was converted to an organization:

1. Go to organization settings: https://github.com/organizations/guglxni/settings
2. Click on **Actions** > **General**
3. Under **Workflow permissions**, ensure "Read and write permissions" is enabled
4. Under **Package creation**, ensure packages can be created

## Step 4: Alternative - Use Personal Access Token

If the above doesn't work, create a Personal Access Token:

1. Go to https://github.com/settings/tokens
2. Click **Generate new token** > **Generate new token (classic)**
3. Select scopes:
   - ✅ `write:packages`
   - ✅ `read:packages`
   - ✅ `delete:packages`
4. Copy the token
5. Go to your repository **Settings** > **Secrets and variables** > **Actions**
6. Add new repository secret:
   - Name: `GHCR_TOKEN`
   - Value: [your token]

Then update the workflow to use this token:

```yaml
- name: Log in to Container Registry
  if: github.event_name != 'pull_request'
  uses: docker/login-action@v3
  with:
    registry: ${{ env.REGISTRY }}
    username: ${{ github.actor }}
    password: ${{ secrets.GHCR_TOKEN }}  # Use custom token instead of GITHUB_TOKEN
```

## Step 5: Verify Package Permissions

After running the workflow, check:

1. Go to https://github.com/guglxni?tab=packages
2. You should see the `digilocker` package listed
3. Click on it to verify it was published successfully

## Step 6: Test the Fix

Run the workflow again by:

1. Making a small commit to trigger the workflow, OR
2. Going to **Actions** tab and manually triggering the "Docker Build & Push" workflow

## Common Issues and Solutions

### Case Sensitivity
- GitHub Container Registry requires lowercase names
- We fixed this by using `${{ github.repository_owner }}/digilocker` instead of `${{ github.repository }}`

### Token Permissions
- The default `GITHUB_TOKEN` should work for most cases
- If not, use a Personal Access Token as described above

### Organization vs Personal Account
- If your account shows as an organization, you may need organization-level settings
- Check if you accidentally converted your personal account to an organization

## Verification Commands

After successful push, you should be able to:

```bash
# Pull the image
docker pull ghcr.io/guglxni/digilocker:latest

# List your packages
gh api user/packages --jq '.[].name'

# Check package versions
gh api user/packages/container/digilocker/versions --jq '.[].name'
```

If you continue having issues, the problem might be at the GitHub organization level or account type. Contact GitHub support or check if your account has any restrictions. 