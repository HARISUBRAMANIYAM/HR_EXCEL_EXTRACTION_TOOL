from jose import jwt,JWTError
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from models import *
from schemas import *
import os
from  datetime import datetime,timedelta,timezone
from fastapi import HTTPException,Depends,status
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable must be set")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
# Utility functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp":expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")



# Dependency to get the current user
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserModel:
    try:
        payload = decode_access_token(token)
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token: No sub claim")
        user = db.query(UserModel).filter(UserModel.username == username).first()
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid user")
        return user
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Could not validate credentials: {e}")

# Role checking dependency
async def check_user_role(required_role: Role, current_user: UserModel = Depends(get_current_user)):
    if current_user.role != required_role and current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=403,
            detail=f"Operation not permitted. Requires {required_role} role."
        )
    return current_user
def require_admin(current_user: UserModel = Depends(get_current_user)):
    if current_user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def require_hr_or_admin(current_user: UserModel = Depends(get_current_user)):
    if current_user.role not in [Role.HR, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HR or Admin access required"
        )
    return current_user

def require_hr(current_user: UserModel = Depends(get_current_user)):
    if current_user.role != Role.HR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HR access required"
        )
    return current_user

def create_refresh_token(user:UserModel):
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub":user.username,"exp":expire,"type":"refresh"}
    encoded_jwt = jwt.encode(to_encode,SECRET_KEY,algorithm=ALGORITHM)
    return encoded_jwt

def sanitize_folder_name(foldername):
        normalize_path = os.path.normpath(foldername)
        _,path_without_drive = os.path.splitdrive(normalize_path)
        folder = path_without_drive.strip(os.sep).replace(os.sep,"_")
        return folder