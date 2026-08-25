import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext'; // Adjust path as needed
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';

const SupportScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [activeTab, setActiveTab] = useState('articles'); // 'articles', 'chat', 'ticket'
  const [searchQuery, setSearchQuery] = useState('');

  // Support Articles Data
  const supportArticles = [
    {
      id: 1,
      icon: '🔒',
      title: 'Changing Your Password',
      description: 'Learn how to securely update your account password',
      category: 'Security',
      content: `
# Changing Your Password

Your password protects your wallet and all your assets. Here's how to change it safely:

## Steps to Change Password:
1. Go to Settings
2. Tap "Change Password"
3. Enter your current password
4. Enter your new password (must be strong)
5. Confirm your new password
6. Your wallet will be automatically re-encrypted

## Important Notes:
⚠️ Your wallet will be re-encrypted with the new password
⚠️ You'll need to set up a new local PIN after changing password
⚠️ Make sure to remember your new password - it cannot be recovered

## Password Requirements:
- At least 8 characters
- One uppercase letter
- One lowercase letter
- One number
- Different from current password

## What Happens Behind the Scenes:
1. We verify your current password
2. Update your Firebase authentication
3. Re-encrypt your wallet with a new encryption key
4. Clear local wallet data (you'll need new PIN)
5. Update all encrypted data in the cloud

💡 Tip: Use a password manager to generate and store strong passwords.
      `,
    },
    {
      id: 2,
      icon: '🔐',
      title: 'Understanding Wallet Encryption',
      description: 'How we keep your wallet secure',
      category: 'Security',
      content: `
# Understanding Wallet Encryption

Your wallet security is our top priority. Here's how we protect your assets:

## Multi-Layer Encryption:

### Cloud Encryption (Password-Based)
- Your wallet is encrypted with your account password
- Uses AES-256 encryption
- Stored securely in Firebase Firestore
- Only you can decrypt it with your password

### Local Encryption (PIN-Based)
- Additional encryption on your device
- Protected by your 6-digit PIN
- Stored in device secure storage
- Faster access without password

## How It Works:

1. **Wallet Creation**
   - Generate 12-word recovery phrase
   - Create private key from phrase
   - Encrypt with both password and PIN
   - Store separately for redundancy

2. **Double Encryption**
   - Cloud: Password + Unique Salt
   - Local: PIN + Unique Salt
   - Two independent encryption layers

3. **Key Derivation**
   - PBKDF2 with 10,000 iterations
   - 256-bit encryption keys
   - Random salt generation
   - Industry-standard security

## What This Means for You:

✅ **Non-Custodial**: Only YOU have access to your keys
✅ **Cloud Backup**: Recover wallet from any device with password
✅ **Quick Access**: Use PIN for daily transactions
✅ **Maximum Security**: Military-grade encryption

## Important Security Tips:

⚠️ Never share your password or PIN
⚠️ Save your recovery phrase offline
⚠️ Use a strong, unique password
⚠️ Enable biometric authentication when available

💡 Your recovery phrase is the master key. Keep it safe offline!
      `,
    },
    {
      id: 3,
      icon: '🏛️',
      title: 'Deploying a DAO',
      description: 'Step-by-step guide to creating your DAO',
      category: 'DAOs',
      content: `
# Deploying a DAO

Create your own Decentralized Autonomous Organization in minutes.

## What is a DAO?

A DAO (Decentralized Autonomous Organization) is an organization governed by smart contracts and token holders, not by traditional management.

## Prerequisites:

Before deploying a DAO, you need:
- ✅ Sufficient balance for gas fees
- ✅ Clear vision for your DAO's purpose
- ✅ Understanding of tokenomics
- ✅ Community to govern with you

## Steps to Deploy:

### 1. Navigate to Launch DAO
- Go to the DAOs tab
- Tap the "+" button
- Select "Launch DAO"

### 2. Configure Basic Details
- **DAO Name**: Choose a memorable name
- **Description**: Explain your DAO's purpose
- **Logo**: Upload an image (optional)

### 3. Set Governance Parameters
- **Token Name**: Governance token name
- **Token Symbol**: 3-5 character symbol
- **Initial Supply**: Total tokens to create
- **Voting Period**: How long votes last
- **Quorum**: Minimum votes needed

### 4. Distribution Strategy
- **Treasury Allocation**: DAO-owned tokens
- **Founder Allocation**: Your initial share
- **Community Allocation**: For early members
- **Vesting Schedule**: Release timeline

### 5. Review & Deploy
- Review all parameters carefully
- Estimated gas cost will be shown
- Confirm transaction in wallet
- Wait for blockchain confirmation

## After Deployment:

✅ Share your DAO contract address
✅ Invite community members
✅ Create first governance proposal
✅ Start building together!

## Gas Costs:

Typical deployment costs:
- Ethereum: $50-200
- Polygon: $1-5
- BSC: $2-10
- Arbitrum: $5-15

💡 Deploy on testnets first to practice!

## Best Practices:

1. **Start Small**: Begin with trusted community
2. **Clear Rules**: Define governance clearly
3. **Transparent**: All decisions on-chain
4. **Patient**: Build trust over time
5. **Legal**: Consult legal advice for your jurisdiction

⚠️ DAO smart contracts are immutable. Triple-check before deploying!
      `,
    },
    {
      id: 4,
      icon: '👛',
      title: 'Wallet Management',
      description: 'Your wallet, your keys, your crypto',
      category: 'Wallet',
      content: `
# Fully Non-Custodial Wallet Management

You are in complete control of your crypto. Here's what that means:

## What is Non-Custodial?

**Non-Custodial** means:
- ✅ YOU control your private keys
- ✅ NO ONE else can access your funds
- ✅ NO company holds your crypto
- ✅ YOU are your own bank

**vs Custodial (like Coinbase):**
- ❌ Company holds your keys
- ❌ They can freeze your account
- ❌ You trust them with your funds
- ❌ Subject to regulations/hacks

## Your Wallet Components:

### 1. Recovery Phrase (Seed Phrase)
- 12 words that generate your wallet
- Master key to all your assets
- Can recover wallet on any device
- NEVER share with anyone
- Store offline in safe place

### 2. Private Key
- Derived from recovery phrase
- Signs all your transactions
- Proves ownership of addresses
- Encrypted in our app
- Never leaves your control

### 3. Public Address
- Your wallet's receiving address
- Safe to share publicly
- Like a bank account number
- Starts with 0x... (Ethereum)
- Generate multiple addresses

## Managing Multiple Wallets:

You can create multiple wallets for:
- 💼 Personal vs Business
- 🎮 Gaming vs Trading
- 🔒 Hot vs Cold storage
- 🌍 Different networks

### Creating Additional Wallets:
1. Settings → Manage Wallets
2. Tap "Create New Wallet"
3. Generate new recovery phrase
4. Secure it separately
5. Switch between wallets easily

## Wallet Security:

### DO:
✅ Save recovery phrase offline
✅ Use strong passwords
✅ Enable biometric authentication
✅ Verify addresses before sending
✅ Test with small amounts first

### DON'T:
❌ Screenshot recovery phrase
❌ Store phrase in cloud
❌ Share private keys
❌ Use public WiFi for transactions
❌ Click suspicious links

## Backup Strategy:

### Triple Backup Method:
1. **Paper**: Write on paper, store in safe
2. **Metal**: Engrave on metal plate
3. **Split**: Divide into parts, store separately

### Cloud Backup (Our Feature):
- Encrypted with YOUR password
- Enables device recovery
- Cannot be decrypted without password
- Additional convenience layer

## Transaction Security:

Every transaction requires:
1. PIN or Password authentication
2. Review transaction details
3. Confirm network and gas fees
4. Final approval

We NEVER:
- ❌ Auto-approve transactions
- ❌ Access your keys
- ❌ See your recovery phrase
- ❌ Control your funds

## Recovery Options:

### If You Lose Device:
1. Install app on new device
2. Select "Import Wallet"
3. Enter 12-word recovery phrase
4. Set new PIN
5. Access restored! ✅

### If You Forget PIN:
1. Use cloud backup with password
2. Or import with recovery phrase
3. Set new PIN
4. Continue using wallet

### If You Forget Password:
1. Use recovery phrase (master key)
2. Import wallet on device
3. Set new password
4. Re-encrypt wallet

## Your Responsibilities:

As a non-custodial wallet user, YOU must:
- 📝 Secure recovery phrase
- 🔐 Remember passwords/PIN
- 🎯 Verify addresses
- ⚠️ Understand transactions
- 💰 Manage gas fees
- 🛡️ Protect your device

## Why Non-Custodial?

**Freedom**: True ownership of assets
**Privacy**: No KYC required
**Censorship-Resistant**: Can't be frozen
**Permissionless**: Access anytime
**Sovereignty**: You are the bank

💡 With great power comes great responsibility. Secure your keys!

⚠️ We cannot recover your funds if you lose your recovery phrase.
      `,
    },
    {
      id: 5,
      icon: '💸',
      title: 'Understanding Gas Fees',
      description: 'What are gas fees and how to optimize them',
      category: 'Transactions',
      content: `
# Understanding Gas Fees

Learn about transaction costs and how to save money.

## What are Gas Fees?

Gas fees are payments made to blockchain validators for:
- Processing your transaction
- Including it in a block
- Securing the network
- Computing smart contract operations

Think of it as postage for sending crypto mail.

## Fee Components:

### Base Fee
- Minimum cost per transaction
- Burns (destroys) tokens
- Adjusts based on network demand
- Can't be avoided

### Priority Fee (Tip)
- Extra payment to validators
- Gets your transaction processed faster
- Optional but recommended
- Higher tip = faster confirmation

## Fee Calculation:

**Total Fee = (Base Fee + Priority Fee) × Gas Used**

Example:
- Base: 30 gwei
- Priority: 2 gwei
- Gas Used: 21,000
- Total: 32 gwei × 21,000 = 672,000 gwei = 0.000672 ETH

## Gas Prices by Network:

Average transaction costs:

**Ethereum (Layer 1):**
- Simple transfer: $2-50
- Token swap: $10-100
- NFT mint: $50-200
- Peak times: Much higher

**Polygon:**
- Simple transfer: $0.01-0.10
- Token swap: $0.05-0.50
- Very affordable!

**Arbitrum/Optimism:**
- Simple transfer: $0.10-1
- Token swap: $0.50-5
- L2 scaling benefits

**BSC:**
- Simple transfer: $0.10-0.50
- Token swap: $0.50-2
- Centralized but cheap

## When Fees Are High:

Gas prices spike when:
- 📈 Popular NFT drops
- 🎮 New game launches
- 💰 DeFi opportunities
- 🚀 Market volatility
- ⏰ Peak US/EU hours

## How to Save on Fees:

### 1. Choose Right Time
- Off-peak hours (late night US time)
- Weekends usually cheaper
- Avoid major events
- Check gas trackers

### 2. Use Layer 2 Solutions
- Polygon, Arbitrum, Optimism
- Much lower fees
- Same security benefits
- Bridge when needed

### 3. Batch Transactions
- Combine multiple operations
- Plan your moves
- One approval for multiple swaps
- Save on each transaction

### 4. Adjust Priority
- Low priority: 1-2 gwei (slower)
- Medium: 2-5 gwei (normal)
- High: 5+ gwei (fast)
- Emergency: 10+ gwei (instant)

### 5. Use Gas Tokens (Advanced)
- CHI, GST2 tokens
- Pre-buy when cheap
- Burn to offset fees
- For power users

## Fee Estimation:

Our app shows:
- 📊 Current gas price
- ⏱️ Estimated time
- 💵 Fee in USD
- 🎚️ Priority options

You choose the speed/cost tradeoff.

## Failed Transactions:

⚠️ Important: Gas fees are charged even if transaction fails because:
- Validators still did work
- Computing was performed
- Block space was used
- Can't be refunded

Prevent failures by:
- ✅ Checking balance first
- ✅ Setting proper slippage
- ✅ Using realistic gas limits
- ✅ Avoiding complex operations during high traffic

## Gas Limits:

**Gas Limit** = Maximum gas you're willing to pay

Common limits:
- ETH transfer: 21,000
- Token transfer: 65,000
- Swap: 150,000-300,000
- Complex DeFi: 500,000+

Set too low → Transaction fails
Set too high → Only use what's needed (get refund)

## Monitoring Tools:

Check current gas prices:
- https://etherscan.io/gastracker
- https://polygonscan.com/gastracker
- In-app gas indicator
- DeFi app estimates

## Pro Tips:

💡 **Telegram Gas Bot**: Get alerts for low gas
💡 **Set Limit Orders**: Execute when gas is low
💡 **Weekend Trading**: Generally 20-30% cheaper
💡 **L2 First**: Move funds to L2 for daily use
💡 **Consolidate**: Fewer, larger transactions

## Common Questions:

**Q: Why did I pay $50 in gas?**
A: High network congestion or complex operation

**Q: Can I get refund if too slow?**
A: No, but unused gas is returned

**Q: Will EIP-4844 lower fees?**
A: Yes, blob transactions reduce L2 costs significantly

**Q: Should I wait for lower gas?**
A: Depends on urgency vs cost savings

Remember: Gas fees fund network security. They're necessary for decentralization!
      `,
    },
    {
      id: 6,
      icon: '🔄',
      title: 'Recovery Phrase Security',
      description: 'Protecting your 12-word recovery phrase',
      category: 'Security',
      content: `
# Recovery Phrase Security

Your 12-word recovery phrase is the most important thing you'll ever protect.

## What is it?

The recovery phrase (also called seed phrase) is:
- 12 random words
- Master key to your wallet
- Can recreate your wallet anywhere
- Cannot be changed
- Irreplaceable if lost

## Why It Matters:

**With your recovery phrase, anyone can:**
- ✅ Access all your funds
- ✅ Transfer everything out
- ✅ See full transaction history
- ✅ Control your assets forever

**Without it, you cannot:**
- ❌ Recover wallet if device lost
- ❌ Access funds on new device
- ❌ Restore if app deleted
- ❌ Get help from support (we don't have it!)

## Viewing Your Recovery Phrase:

To see your phrase in our app:
1. Settings → Show Recovery Phrase
2. Enter your 6-digit PIN
3. View and write down all 12 words
4. Store securely offline
5. Never screenshot it!

## Storing Your Phrase:

### ✅ GOOD Methods:

**1. Metal Backup**
- Engrave on stainless steel plate
- Fireproof & waterproof
- Products: Cryptosteel, Billfodl
- Most secure option

**2. Paper in Safe**
- Write clearly on paper
- Store in fireproof safe
- Multiple copies in different locations
- Laminate for water protection

**3. Split Method**
- Divide into 2-3 parts
- Store in separate secure locations
- Requires multiple parts to reconstruct
- Advanced security

### ❌ BAD Methods:

**Never Store:**
- ❌ Phone screenshots
- ❌ Cloud storage (Google Drive, iCloud)
- ❌ Email to yourself
- ❌ Password managers (online)
- ❌ Shared notes apps
- ❌ Unencrypted text files
- ❌ Photos on device

## Best Practices:

### Writing Down:
1. Use pen and paper (not pencil)
2. Write clearly and carefully
3. Double-check each word
4. Verify order (numbers 1-12)
5. Test recovery on another device
6. Store original safely

### Multiple Copies:
- Make 2-3 copies
- Store in different physical locations
- Consider: Home safe, bank deposit box, trusted family member's safe
- Don't keep all copies together

### Testing Recovery:
1. Write down phrase
2. Delete app (on test device!)
3. Reinstall and recover
4. Verify all funds restored
5. Now you're confident!

## Security Scenarios:

### Scenario 1: Phone Lost/Stolen
**With Phrase**: ✅ Install app, recover, access funds
**Without**: ❌ Funds lost forever

### Scenario 2: App Deleted Accidentally
**With Phrase**: ✅ Reinstall, recover immediately
**Without**: ❌ Can't access wallet

### Scenario 3: Someone Found Phrase
**With Phrase in Wrong Hands**: ❌ They steal everything
**Properly Secured**: ✅ Safe

### Scenario 4: House Fire
**Metal Backup**: ✅ Survives, funds safe
**Paper Only**: ❌ Destroyed, funds lost

## Common Mistakes:

❌ **"I'll remember it"**
→ You won't. Especially 12 random words.

❌ **"I'll save it later"**
→ Device breaks tomorrow. Too late.

❌ **"Cloud backup is secure"**
→ Clouds get hacked. Don't risk it.

❌ **"I trust this app"**
→ Apps can be malicious. Verify first.

❌ **"I'll screenshot it"**
→ Screenshots leak. Clipboard viruses exist.

## Advanced: Passphrase

Some users add a 13th word passphrase:
- Extra security layer
- Creates completely new wallet
- Must remember both phrase + passphrase
- Plausible deniability option
- Not recommended for beginners

## Emergency Planning:

Create an inheritance plan:
1. Store phrase in safe
2. Leave instructions with trusted executor
3. Include this app name
4. Explain recovery process
5. Don't leave accessible to everyone

### What to Include:
- "My crypto is in [App Name]"
- "Recovery phrase in safe deposit box at [Bank]"
- "Instructions: Install app → Import Wallet → Enter phrase"
- "Contact [crypto-savvy friend] for help"

## Verification:

To verify phrase is correct:
1. Import wallet on second device
2. Check addresses match
3. Send small test transaction
4. Receive on main wallet
5. Confirm it works

## Red Flags:

🚩 Someone asks for your phrase
🚩 "Support" needs to verify phrase
🚩 Website requires seed phrase entry
🚩 App needs phrase to "sync"
🚩 Too good to be true offers

**NEVER share your recovery phrase with ANYONE. Not even us!**

## What We Know:

Our app knows:
- ✅ Your encrypted wallet
- ✅ Your public address
- ✅ Your account email

Our app does NOT know:
- ❌ Your recovery phrase
- ❌ Your private key
- ❌ Your password/PIN (hashed only)

## Final Checklist:

✅ Written down phrase
✅ Verified accuracy
✅ Stored in safe location
✅ Made backup copy
✅ Tested recovery
✅ Secured from others
✅ Planned for inheritance
✅ Never shared with anyone

Your recovery phrase is your responsibility. We cannot help if you lose it!

💡 Treat your recovery phrase like a $1,000,000 bearer bond. Because that's what it could be worth someday.
      `,
    },
  ];

  const filteredArticles = supportArticles.filter(article =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    article.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ['All', ...new Set(supportArticles.map(a => a.category))];

  const handleEmailSupport = () => {
    const email = 'support@sysfidao.com';
    const subject = 'Support Request';
    const body = 'Please describe your issue:\n\n';
    
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'articles' && styles.activeTab]}
          onPress={() => setActiveTab('articles')}
        >
          <Ionicons
            name="book-outline"
            size={20}
            color={activeTab === 'articles' ? theme.COLORS.primary : theme.COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'articles' && styles.activeTabText]}>
            Articles
          </Text>
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={20}
            color={activeTab === 'chat' ? theme.COLORS.primary : theme.COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>
            Live Chat
          </Text>
        </TouchableOpacity> */}

        <TouchableOpacity
          style={[styles.tab, activeTab === 'ticket' && styles.activeTab]}
          onPress={() => setActiveTab('ticket')}
        >
          <Ionicons
            name="mail-outline"
            size={20}
            color={activeTab === 'ticket' ? theme.COLORS.primary : theme.COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'ticket' && styles.activeTabText]}>
            Ticket
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'articles' && (
          <ArticlesTab
            articles={filteredArticles}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categories={categories}
            navigation={navigation}
            theme={theme}
          />
        )}

        {activeTab === 'chat' && (
          <ChatTab navigation={navigation} theme={theme} />
        )}

        {activeTab === 'ticket' && (
          <TicketTab handleEmailSupport={handleEmailSupport} theme={theme} />
        )}
      </View>
    </View>
  );
};

// Articles Tab Component
const ArticlesTab = ({ articles, searchQuery, setSearchQuery, categories, navigation, theme }) => {
  const styles = createStyles(theme);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const displayedArticles = selectedCategory === 'All'
    ? articles
    : articles.filter(a => a.category === selectedCategory);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={theme.COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search articles..."
          placeholderTextColor={theme.COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === category && styles.categoryChipTextActive
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Articles List */}
      {displayedArticles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-outline" size={64} color={theme.COLORS.textTertiary} />
          <Text style={styles.emptyStateText}>No articles found</Text>
          <Text style={styles.emptyStateSubtext}>Try a different search term</Text>
        </View>
      ) : (
        displayedArticles.map(article => (
          <Card
            key={article.id}
            style={styles.articleCard}
            onPress={() => navigation.navigate('ArticleDetail', { article })}
          >
            <View style={styles.articleIcon}>
              <Text style={styles.articleIconText}>{article.icon}</Text>
            </View>
            <View style={styles.articleContent}>
              <View style={styles.articleHeader}>
                <Text style={styles.articleTitle}>{article.title}</Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{article.category}</Text>
                </View>
              </View>
              <Text style={styles.articleDescription}>{article.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} />
          </Card>
        ))
      )}
    </ScrollView>
  );
};

// Chat Tab Component
const ChatTab = ({ navigation, theme }) => {
  const styles = createStyles(theme);
  
  return (
    <View style={styles.chatContainer}>
      <View style={styles.chatPlaceholder}>
        <Ionicons name="chatbubbles" size={64} color={theme.COLORS.primary} />
        <Text style={styles.chatPlaceholderTitle}>Live Chat Support</Text>
        <Text style={styles.chatPlaceholderText}>
          Connect with our support team in real-time for immediate assistance.
        </Text>

        <View style={styles.chatFeatures}>
          <ChatFeature icon="time-outline" text="Average response: 2-5 minutes" theme={theme} />
          <ChatFeature icon="people-outline" text="Expert support agents" theme={theme} />
          <ChatFeature icon="shield-checkmark-outline" text="Secure & private" theme={theme} />
        </View>

        <Button
          title="Start Chat"
          onPress={() => navigation.navigate('LiveChat')}
          variant="primary"
          fullWidth
          icon={<Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFF" />}
        />

        <Text style={styles.chatHours}>
          Available: Monday - Friday, 9 AM - 6 PM UTC
        </Text>
      </View>
    </View>
  );
};

const ChatFeature = ({ icon, text, theme }) => {
  const styles = createStyles(theme);
  
  return (
    <View style={styles.chatFeature}>
      <Ionicons name={icon} size={20} color={theme.COLORS.primary} />
      <Text style={styles.chatFeatureText}>{text}</Text>
    </View>
  );
};

// Ticket Tab Component
const TicketTab = ({ handleEmailSupport, theme }) => {
  const styles = createStyles(theme);
  
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Card style={styles.ticketCard}>
        <View style={styles.ticketIcon}>
          <Ionicons name="mail" size={48} color={theme.COLORS.primary} />
        </View>

        <Text style={styles.ticketTitle}>Email Support</Text>
        <Text style={styles.ticketDescription}>
          For non-urgent issues or detailed inquiries, send us an email and we'll get back to you within 24 hours.
        </Text>

        <View style={styles.ticketInfo}>
          <TicketInfoItem icon="mail-outline" label="Email" value="support@sysfidao.com" theme={theme} />
          <TicketInfoItem icon="time-outline" label="Response Time" value="Within 24 hours" theme={theme} />
          <TicketInfoItem icon="calendar-outline" label="Available" value="7 days a week" theme={theme} />
        </View>

        <Button
          title="Send Email"
          onPress={handleEmailSupport}
          variant="primary"
          fullWidth
          icon={<Ionicons name="send-outline" size={20} color="#FFF" />}
        />

        <View style={styles.ticketTips}>
          <Text style={styles.ticketTipsTitle}>💡 Tips for faster response:</Text>
          <Text style={styles.ticketTip}>• Be specific about your issue</Text>
          <Text style={styles.ticketTip}>• Include screenshots if relevant</Text>
          <Text style={styles.ticketTip}>• Mention your wallet address (if needed)</Text>
          <Text style={styles.ticketTip}>• Describe steps to reproduce</Text>
        </View>
      </Card>
    </ScrollView>
  );
};

const TicketInfoItem = ({ icon, label, value, theme }) => {
  const styles = createStyles(theme);
  
  return (
    <View style={styles.ticketInfoItem}>
      <Ionicons name={icon} size={20} color={theme.COLORS.primary} />
      <View style={styles.ticketInfoContent}>
        <Text style={styles.ticketInfoLabel}>{label}</Text>
        <Text style={styles.ticketInfoValue}>{value}</Text>
      </View>
    </View>
  );
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.COLORS.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.surface,
    },
    backButton: {
      padding: theme.SPACING.xs,
    },
    headerTitle: {
      fontSize: theme.FONTS.sizes.xl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
    },
    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.COLORS.border,
      backgroundColor: theme.COLORS.surface,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.SPACING.md,
      gap: theme.SPACING.xs,
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: theme.COLORS.primary,
    },
    tabText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      fontWeight: '500',
    },
    activeTabText: {
      color: theme.COLORS.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.SPACING.md,
      paddingBottom: 120,
    },

    // Search & Filter
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.COLORS.surface,
      borderRadius: 12,
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      marginBottom: theme.SPACING.md,
      gap: theme.SPACING.sm,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    searchInput: {
      flex: 1,
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.text,
    },
    categoriesContainer: {
      paddingBottom: theme.SPACING.md,
      gap: theme.SPACING.sm,
    },
    categoryChip: {
      paddingHorizontal: theme.SPACING.md,
      paddingVertical: theme.SPACING.sm,
      backgroundColor: theme.COLORS.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    categoryChipActive: {
      backgroundColor: theme.COLORS.primary,
      borderColor: theme.COLORS.primary,
    },
    categoryChipText: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      fontWeight: '500',
    },
    categoryChipTextActive: {
      color: '#FFF',
    },

    // Articles
    articleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.SPACING.md,
      marginBottom: theme.SPACING.sm,
      gap: theme.SPACING.md,
    },
    articleIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.COLORS.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    articleIconText: {
      fontSize: 24,
    },
    articleContent: {
      flex: 1,
    },
    articleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.SPACING.xs,
    },
    articleTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
      flex: 1,
    },
    categoryBadge: {
      paddingHorizontal: theme.SPACING.sm,
      paddingVertical: 2,
      backgroundColor: theme.COLORS.primary + '20',
      borderRadius: 8,
    },
    categoryBadgeText: {
      fontSize: theme.FONTS.sizes.xs,
      color: theme.COLORS.primary,
      fontWeight: '600',
    },
    articleDescription: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
    },

    // Empty State
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.SPACING.xxl * 2,
    },
    emptyStateText: {
      fontSize: theme.FONTS.sizes.lg,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginTop: theme.SPACING.md,
    },
    emptyStateSubtext: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginTop: theme.SPACING.xs,
    },

    // Chat Tab
    chatContainer: {
      flex: 1,
      justifyContent: 'center',
      padding: theme.SPACING.lg,
    },
    chatPlaceholder: {
      alignItems: 'center',
    },
    chatPlaceholderTitle: {
      fontSize: theme.FONTS.sizes.xl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginTop: theme.SPACING.lg,
      marginBottom: theme.SPACING.sm,
    },
    chatPlaceholderText: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: theme.SPACING.xl,
      lineHeight: 22,
    },
    chatFeatures: {
      width: '100%',
      marginBottom: theme.SPACING.xl,
    },
    chatFeature: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.sm,
      marginBottom: theme.SPACING.md,
    },
    chatFeatureText: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.text,
    },
    chatHours: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginTop: theme.SPACING.md,
      textAlign: 'center',
    },

    // Ticket Tab
    ticketCard: {
      padding: theme.SPACING.lg,
      alignItems: 'center',
    },
    ticketIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.COLORS.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.SPACING.lg,
    },
    ticketTitle: {
      fontSize: theme.FONTS.sizes.xl,
      fontWeight: 'bold',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
    },
    ticketDescription: {
      fontSize: theme.FONTS.sizes.md,
      color: theme.COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: theme.SPACING.xl,
      lineHeight: 22,
    },
    ticketInfo: {
      width: '100%',
      marginBottom: theme.SPACING.xl,
    },
    ticketInfoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.SPACING.md,
      marginBottom: theme.SPACING.md,
    },
    ticketInfoContent: {
      flex: 1,
    },
    ticketInfoLabel: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginBottom: 2,
    },
    ticketInfoValue: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
    },
    ticketTips: {
      width: '100%',
      marginTop: theme.SPACING.xl,
      padding: theme.SPACING.md,
      backgroundColor: theme.COLORS.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.COLORS.border,
    },
    ticketTipsTitle: {
      fontSize: theme.FONTS.sizes.md,
      fontWeight: '600',
      color: theme.COLORS.text,
      marginBottom: theme.SPACING.sm,
    },
    ticketTip: {
      fontSize: theme.FONTS.sizes.sm,
      color: theme.COLORS.textSecondary,
      marginTop: theme.SPACING.xs,
      lineHeight: 20,
    },
  });

export default SupportScreen;