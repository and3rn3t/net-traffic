"""
Authentication Service
Handles user authentication, JWT token generation, and API key management
"""
import logging
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List
import aiosqlite
from jose import JWTError, jwt
from passlib.context import CryptContext

from models.auth import (
    User, UserInDB, UserCreate, UserUpdate, Token, TokenData,
    APIKey, APIKeyCreate, UserRole
)

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings (should be in environment variables in production)
SECRET_KEY = "your-secret-key-change-in-production"  # TODO: Load from env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


class AuthService:
    """
    Authentication and authorization service
    Handles user management, JWT tokens, and API keys
    """

    def __init__(self, db_path: str = "net_traffic.db"):
        """Initialize authentication service"""
        self.db_path = db_path
        self.db: Optional[aiosqlite.Connection] = None

    async def initialize(self):
        """Initialize database connection and create auth tables"""
        self.db = await aiosqlite.connect(self.db_path)
        self.db.row_factory = aiosqlite.Row
        await self._create_tables()
        await self._create_default_admin()
        logger.info("Authentication service initialized")

    async def close(self):
        """Close database connection"""
        if self.db:
            await self.db.close()
            logger.info("Authentication service closed")

    async def _create_tables(self):
        """Create authentication tables"""
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT,
                full_name TEXT,
                hashed_password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer',
                disabled INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                last_login INTEGER
            )
        """)

        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                key_hash TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                last_used INTEGER,
                expires_at INTEGER,
                disabled INTEGER NOT NULL DEFAULT 0,
                permissions TEXT,  -- JSON array
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # Create indexes
        await self.db.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
        await self.db.execute("CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)")
        await self.db.commit()

    async def _create_default_admin(self):
        """Create default admin user if no users exist"""
        async with self.db.execute("SELECT COUNT(*) FROM users") as cursor:
            row = await cursor.fetchone()
            if row[0] == 0:
                # Create default admin user
                admin_user = UserCreate(
                    username="admin",
                    email="admin@netinsight.local",
                    password="Admin123!",  # CHANGE THIS IN PRODUCTION
                    full_name="Administrator",
                    role=UserRole.ADMIN
                )
                await self.create_user(admin_user)
                logger.warning("Default admin user created - username: admin, password: Admin123! - CHANGE THIS!")

    # Password hashing functions
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)

    def hash_api_key(self, api_key: str) -> str:
        """Hash an API key for storage"""
        return hashlib.sha256(api_key.encode()).hexdigest()

    # JWT token functions
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> Token:
        """Create a JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

        return Token(
            access_token=encoded_jwt,
            token_type="bearer",
            expires_in=int(expires_delta.total_seconds()) if expires_delta else ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    def decode_access_token(self, token: str) -> Optional[TokenData]:
        """Decode and verify a JWT token"""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            role: str = payload.get("role")
            exp: int = payload.get("exp")
            if username is None:
                return None
            return TokenData(username=username, role=role, exp=exp)
        except JWTError as e:
            logger.warning(f"Token decode error: {e}")
            return None

    # User management
    async def get_user(self, username: str) -> Optional[UserInDB]:
        """Get user by username"""
        async with self.db.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None

            return UserInDB(
                id=row["id"],
                username=row["username"],
                email=row["email"],
                full_name=row["full_name"],
                hashed_password=row["hashed_password"],
                role=UserRole(row["role"]),
                disabled=bool(row["disabled"]),
                created_at=datetime.fromtimestamp(row["created_at"]),
                last_login=datetime.fromtimestamp(row["last_login"]) if row["last_login"] else None
            )

    async def create_user(self, user_create: UserCreate) -> User:
        """Create a new user"""
        user_id = secrets.token_urlsafe(16)
        hashed_password = self.get_password_hash(user_create.password)
        created_at = int(datetime.utcnow().timestamp())

        await self.db.execute(
            """
            INSERT INTO users (id, username, email, full_name, hashed_password, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                user_create.username,
                user_create.email,
                user_create.full_name,
                hashed_password,
                user_create.role.value,
                created_at
            )
        )
        await self.db.commit()

        return User(
            id=user_id,
            username=user_create.username,
            email=user_create.email,
            full_name=user_create.full_name,
            role=user_create.role,
            disabled=False,
            created_at=datetime.fromtimestamp(created_at)
        )

    async def authenticate_user(self, username: str, password: str) -> Optional[UserInDB]:
        """Authenticate a user with username and password"""
        user = await self.get_user(username)
        if not user:
            return None
        if not self.verify_password(password, user.hashed_password):
            return None
        if user.disabled:
            return None

        # Update last login
        await self.db.execute(
            "UPDATE users SET last_login = ? WHERE id = ?",
            (int(datetime.utcnow().timestamp()), user.id)
        )
        await self.db.commit()

        return user

    async def update_user(self, username: str, user_update: UserUpdate) -> Optional[User]:
        """Update user information"""
        user = await self.get_user(username)
        if not user:
            return None

        update_fields = []
        update_values = []

        if user_update.email is not None:
            update_fields.append("email = ?")
            update_values.append(user_update.email)

        if user_update.full_name is not None:
            update_fields.append("full_name = ?")
            update_values.append(user_update.full_name)

        if user_update.password is not None:
            update_fields.append("hashed_password = ?")
            update_values.append(self.get_password_hash(user_update.password))

        if user_update.role is not None:
            update_fields.append("role = ?")
            update_values.append(user_update.role.value)

        if user_update.disabled is not None:
            update_fields.append("disabled = ?")
            update_values.append(1 if user_update.disabled else 0)

        if not update_fields:
            return User(**user.dict(exclude={"hashed_password"}))

        update_values.append(user.id)
        await self.db.execute(
            f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?",
            tuple(update_values)
        )
        await self.db.commit()

        # Fetch updated user
        return await self.get_user_without_password(username)

    async def get_user_without_password(self, username: str) -> Optional[User]:
        """Get user without password hash"""
        user = await self.get_user(username)
        if not user:
            return None
        return User(**user.dict(exclude={"hashed_password"}))

    async def list_users(self) -> List[User]:
        """List all users (without passwords)"""
        async with self.db.execute("SELECT * FROM users ORDER BY created_at DESC") as cursor:
            rows = await cursor.fetchall()
            return [
                User(
                    id=row["id"],
                    username=row["username"],
                    email=row["email"],
                    full_name=row["full_name"],
                    role=UserRole(row["role"]),
                    disabled=bool(row["disabled"]),
                    created_at=datetime.fromtimestamp(row["created_at"]),
                    last_login=datetime.fromtimestamp(row["last_login"]) if row["last_login"] else None
                )
                for row in rows
            ]

    async def delete_user(self, username: str) -> bool:
        """Delete a user"""
        user = await self.get_user(username)
        if not user:
            return False

        await self.db.execute("DELETE FROM users WHERE id = ?", (user.id,))
        await self.db.commit()
        return True

    # API Key management
    def generate_api_key(self) -> str:
        """Generate a new API key"""
        return f"nti_{secrets.token_urlsafe(32)}"

    async def create_api_key(self, user_id: str, api_key_create: APIKeyCreate) -> tuple[APIKey, str]:
        """Create a new API key"""
        api_key_id = secrets.token_urlsafe(16)
        raw_key = self.generate_api_key()
        key_hash = self.hash_api_key(raw_key)
        created_at = int(datetime.utcnow().timestamp())
        expires_at = None

        if api_key_create.expires_days:
            expires_at = int((datetime.utcnow() + timedelta(days=api_key_create.expires_days)).timestamp())

        await self.db.execute(
            """
            INSERT INTO api_keys (id, key_hash, name, user_id, created_at, expires_at, permissions)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                api_key_id,
                key_hash,
                api_key_create.name,
                user_id,
                created_at,
                expires_at,
                ",".join(api_key_create.permissions) if api_key_create.permissions else ""
            )
        )
        await self.db.commit()

        api_key = APIKey(
            id=api_key_id,
            key=key_hash,
            name=api_key_create.name,
            user_id=user_id,
            created_at=datetime.fromtimestamp(created_at),
            expires_at=datetime.fromtimestamp(expires_at) if expires_at else None,
            disabled=False,
            permissions=api_key_create.permissions
        )

        return api_key, raw_key  # Return the raw key only once

    async def verify_api_key(self, api_key: str) -> Optional[User]:
        """Verify an API key and return the associated user"""
        key_hash = self.hash_api_key(api_key)

        async with self.db.execute(
            "SELECT * FROM api_keys WHERE key_hash = ? AND disabled = 0",
            (key_hash,)
        ) as cursor:
            key_row = await cursor.fetchone()
            if not key_row:
                return None

        # Check expiration
        if key_row["expires_at"] and datetime.utcnow().timestamp() > key_row["expires_at"]:
            return None

        # Update last used
        await self.db.execute(
            "UPDATE api_keys SET last_used = ? WHERE id = ?",
            (int(datetime.utcnow().timestamp()), key_row["id"])
        )
        await self.db.commit()

        # Get associated user
        async with self.db.execute(
            "SELECT * FROM users WHERE id = ?", (key_row["user_id"],)
        ) as cursor:
            user_row = await cursor.fetchone()
            if not user_row:
                return None

            return User(
                id=user_row["id"],
                username=user_row["username"],
                email=user_row["email"],
                full_name=user_row["full_name"],
                role=UserRole(user_row["role"]),
                disabled=bool(user_row["disabled"]),
                created_at=datetime.fromtimestamp(user_row["created_at"]),
                last_login=datetime.fromtimestamp(user_row["last_login"]) if user_row["last_login"] else None
            )

    async def list_user_api_keys(self, user_id: str) -> List[APIKey]:
        """List all API keys for a user"""
        async with self.db.execute(
            "SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [
                APIKey(
                    id=row["id"],
                    key=row["key_hash"][:16] + "...",  # Show partial hash for security
                    name=row["name"],
                    user_id=row["user_id"],
                    created_at=datetime.fromtimestamp(row["created_at"]),
                    last_used=datetime.fromtimestamp(row["last_used"]) if row["last_used"] else None,
                    expires_at=datetime.fromtimestamp(row["expires_at"]) if row["expires_at"] else None,
                    disabled=bool(row["disabled"]),
                    permissions=row["permissions"].split(",") if row["permissions"] else []
                )
                for row in rows
            ]

    async def revoke_api_key(self, key_id: str, user_id: str) -> bool:
        """Revoke (disable) an API key"""
        await self.db.execute(
            "UPDATE api_keys SET disabled = 1 WHERE id = ? AND user_id = ?",
            (key_id, user_id)
        )
        await self.db.commit()
        return True
