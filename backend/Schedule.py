from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import logging
from pathlib import Path
import os
import pandas as pd
import uuid
from sqlalchemy.orm import Session
from models import ProcessedFilePF, ProcessedFileESI, UserModel,SessionLocal
from schemas import Role


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='scheduler.log'
)
logger = logging.getLogger('scheduler')

# Create a scheduler
scheduler = BackgroundScheduler()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
def process_pending_pf_files():
    """
    Process PF files in the pending directory at scheduled times
    """
    logger.info(f"Starting scheduled PF file processing at {datetime.now()}")
    
    # Define the pending directory where files are placed for processing
    pending_dir = Path("pending_pf_files")
    if not pending_dir.exists():
        logger.warning(f"Pending directory {pending_dir} does not exist")
        return
    
    db = next(get_db())
    admin_user = db.query(UserModel).filter(UserModel.role == Role.ADMIN).first()
    
    if not admin_user:
        logger.error("No admin user found to associate with scheduled processing")
        return
    try:
        # Process all Excel files in the pending directory
        excel_files = list(pending_dir.glob("*.xls*"))
        logger.info(f"Found {len(excel_files)} files to process")
        
        for excel_file in excel_files:
            logger.info(f"Processing file: {excel_file.name}")
            
            try:
                # Similar processing logic as in your API endpoint
                if excel_file.suffix == ".xlsx":
                    df = pd.read_excel(excel_file)
                else:
                    df = pd.read_excel(excel_file, engine="xlrd")
                
                if df.empty:
                    logger.warning(f"File {excel_file.name} is empty")
                    continue
                
                # Check for required columns
                required_columns = {
                    "UAN No": ["UAN No"],
                    "Employee Name": ["Employee Name"],
                    "Gross Wages": ["Total Salary", "Gross Salary"],
                    "EPF Wages": ["PF Gross", "EPF Gross"],
                    "LOP Days": ["LOP", "LOP Days"]
                }
                # Find actual column names in the DataFrame
                column_mapping = {}
                missing_columns = []
                
                for field, alternatives in required_columns.items():
                    found = False
                    for alt in alternatives:
                        if alt in df.columns:
                            column_mapping[field] = alt
                            found = True
                            break
                    if not found:
                        missing_columns.append(field)
                
                if missing_columns:
                    logger.warning(f"Missing required columns in {excel_file.name}: {', '.join(missing_columns)}")
                    continue
                
                # Process the data with correct logic
                df[column_mapping["UAN No"]] = pd.to_numeric(df[column_mapping["UAN No"]], errors='coerce').fillna(0).astype(int)
                uan_str = df[column_mapping["UAN No"]].astype(str)
                uan_no = uan_str.str.replace("-", "").astype("int64")
                member_name = df[column_mapping["Employee Name"]]
                gross_wages = df[column_mapping["Gross Wages"]].fillna(0).round().astype(int)
                epf_wages = df[column_mapping["EPF Wages"]].fillna(0).round().astype(int)
                lop_days = df[column_mapping["LOP Days"]]
                
                # Calculate derived fields
                eps_wages = epf_wages.apply(lambda x: min(x, 15000) if x > 0 else 0)
                edli_wages = epf_wages.apply(lambda x: min(x, 15000) if x > 0 else 0)
                epf_contrib_remitted = (epf_wages * 0.12).round().astype(int)
                eps_contrib_remitted = (eps_wages * 0.0833).round().astype(int)  # 8.33%
                epf_eps_diff_remitted = (epf_contrib_remitted - eps_contrib_remitted).astype(int)
                ncp_days = lop_days
                refund_of_advances = 0
                
                output_df = pd.DataFrame({
                    "UAN No": uan_no,
                    "MEMBER NAME": member_name,
                    "GROSS WAGES": gross_wages,
                    "EPF Wages": epf_wages,
                    "EPS Wages": eps_wages,
                    "EDLI WAGES": edli_wages,
                    "EPF CONTRI REMITTED": epf_contrib_remitted,
                    "EPS CONTRI REMITTED": eps_contrib_remitted,
                    "EPF EPS DIFF REMITTED": epf_eps_diff_remitted,
                    "NCP DAYS": ncp_days,
                    "REFUND OF ADVANCES": refund_of_advances,
                })
                
                # Create output directories if they don't exist
                excel_output_dir = Path("processed_excels_pf")
                excel_output_dir.mkdir(parents=True, exist_ok=True)
                text_output_dir = Path("processed_texts_pf")
                text_output_dir.mkdir(parents=True, exist_ok=True)
                
                original_stem = excel_file.stem
                excel_filename = f"{original_stem}_{uuid.uuid4()}.xlsx"
                text_filename = f"{original_stem}_{uuid.uuid4()}.txt"
                excel_file_path = excel_output_dir / excel_filename
                text_file_path = text_output_dir / text_filename
                
                # Save Excel output
                output_df.to_excel(excel_file_path, index=False)
                
                # Prepare text file content
                output_lines = [
                    "#~#".join(map(str, row)) for row in output_df.values.tolist()
                ]
                header_line = "#~#".join(output_df.columns)
                output_lines.insert(0, header_line)
                
                # Save text output
                with open(text_file_path, "w") as f:
                    f.write("\n".join(output_lines))
                
                logger.info(f"Successfully processed PF file: {excel_file.name}")
                
                # Move processed file to archive
                archive_dir = Path("pf_processed_archive")
                archive_dir.mkdir(parents=True, exist_ok=True)
                archive_path = archive_dir / f"{excel_file.name}.processed_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                excel_file.rename(archive_path)
                
            except Exception as e:
                logger.error(f"Error processing PF file {excel_file.name}: {str(e)}", exc_info=True)
        
        logger.info("Completed scheduled PF report processing")
        return True
        
    except Exception as e:
        logger.error(f"Error in PF report processing: {str(e)}", exc_info=True)
        return False

def process_pending_esi_files(
    folder_path: str = Form(...),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)):
    folder = Path(folder_path)
    if not folder.is_dir():
        error_message = f"Invalid folder path: {folder_path}"
        db_file = ProcessedFileESI(
            user_id=current_user.id,
            filename="N/A",
            filepath=folder_path,
            status="error",
            message=error_message,
        )
        db.add(db_file)
        db.commit()
        raise HTTPException(status_code=400, detail=error_message)
    excel_files = list(folder.glob("*.xls*"))
    if not excel_files:
        error_message = f"No Excel files found in the folder: {folder_path}"
        db_file = ProcessedFileESI(
            user_id=current_user.id,
            filename="N/A",
            filepath=folder_path,
            status="error",
            message=error_message,
        )
        db.add(db_file)
        db.commit()
        raise HTTPException(status_code=400, detail=error_message)
    processed_files = []
    overall_status = "success"
    overall_message = "All files processed successfully."
    for excel_file in excel_files:
        try:
            try:
                if excel_file.suffix == ".xlsx":
                    df = pd.read_excel(excel_file)
                else:
                    df = pd.read_excel(excel_file, engine="xlrd")
                if df.empty:
                    error_message = f"Excel file {excel_file.name} is empty."
                    db_file = ProcessedFileESI(
                        user_id=current_user.id,
                        filename=excel_file.name,
                        filepath=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                    db.add(db_file)
                    db.commit()
                    overall_status = "error"
                    overall_message = "Some files had errors during processing."
                    processed_files.append(
                        FileProcessResult(
                            file_path=str(excel_file),
                            status="error",
                            message=error_message,
                        )
                    )
                    continue
            except Exception as e:
                error_message = f"Error reading Excel file {excel_file.name}: {str(e)}"
                db_file = ProcessedFileESI(
                    user_id=current_user.id,
                    filename=excel_file.name,
                    filepath=str(excel_file),
                    status="error",
                    message=error_message,
                )
                db.add(db_file)
                db.commit()
                overall_status = "error"
                overall_message = "Some files had errors during processing."
                processed_files.append(
                    FileProcessResult(
                        file_path=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                )
                continue
            try:
                required_columns = {
                    "ESI No": ["ESI N0"],
                    "Employee Name": ["Employee Name"],
                    "ESI Gross": ["ESI Gross"],
                    "Worked Days": ["Worked days"]
                }
                column_mapping = {}
                missing_columns = []
                for field, alternatives in required_columns.items():
                    found = False
                    for alt in alternatives:
                        if alt in df.columns:
                            column_mapping[field] = alt
                            found = True
                            break
                    if not found:
                        missing_columns.append(field)
                if missing_columns:
                    error_message = f"Missing required columns in {excel_file.name}: {', '.join(missing_columns)}"
                    db_file = ProcessedFileESI(
                        user_id=current_user.id,
                        filename=excel_file.name,
                        filepath=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                    db.add(db_file)
                    db.commit()
                    overall_status = "error"
                    overall_message = "Some files had errors during processing."
                    processed_files.append(
                        FileProcessResult(
                            file_path=str(excel_file),
                            status="error",
                            message=error_message,
                        )
                    )
                    continue
                # Process the data with correct logic
                df[column_mapping["ESI No"]]=pd.to_numeric(df[column_mapping["ESI No"]],errors='coerce').fillna(0).astype(int)
                esi_str = df[column_mapping["ESI No"]].astype(str)
                esi_no = esi_str.str.replace("-","").astype("int64")
                member_name = df[column_mapping["Employee Name"]]
                esi_gross = df[column_mapping["ESI Gross"]].fillna(0).round().astype(int)
                worked_days = df[column_mapping["Worked Days"]]

                output_df = pd.DataFrame({
                    "ESI No": esi_no,
                    "MEMBER NAME": member_name,
                    "ESI GROSS": esi_gross,
                    "WORKED DAYS": worked_days
                })
                # Create output directories if they don't exist
                excel_output_dir = Path("processed_excels_esi")
                excel_output_dir.mkdir(parents=True, exist_ok=True)
                text_output_dir = Path("processed_texts_esi")
                text_output_dir.mkdir(parents=True, exist_ok=True)
                original_stem = excel_file.stem
                excel_filename = f"{original_stem}_{uuid.uuid4()}_esi.xlsx"
                text_filename = f"{original_stem}_{uuid.uuid4()}_esi.txt"
                excel_file_path = excel_output_dir / excel_filename
                text_file_path = text_output_dir / text_filename
                output_df.to_excel(excel_file_path, index=False)
                # Prepare text file content
                output_lines = [
                    "#~#".join(map(str, row)) for row in output_df.values.tolist()
                ]
                header_line = "#~#".join(output_df.columns)
                output_lines.insert(0, header_line)
                with open(text_file_path, "w") as f:
                    f.write("\n".join(output_lines))
                # Save to database
                db_file = ProcessedFileESI(
                    user_id=current_user.id,
                    filename=excel_file.name,
                    filepath=f"{str(excel_file_path)},{str(text_file_path)}",
                    status="success",
                    message="File processed successfully.",
                )
                db.add(db_file)
                db.commit()
                processed_files.append(
                    FileProcessResult(
                        file_path=f"{str(excel_file_path)},{str(text_file_path)}",
                        status="success",
                        message="File processed successfully.",
                    )
                )
            except Exception as e:
                error_message = f"Error processing file {excel_file.name}: {str(e)}"
                db_file = ProcessedFileESI(
                    user_id=current_user.id,
                    filename=excel_file.name,
                    filepath=str(excel_file),
                    status="error",
                    message=error_message,
                )
                db.add(db_file)
                db.commit()
                overall_status = "error"
                overall_message = "Some files had errors during processing."
                processed_files.append(
                    FileProcessResult(
                        file_path=str(excel_file),
                        status="error",
                        message=error_message,
                    )
                )
        except Exception as e:
            error_message = f"Unexpected error processing folder: {str(e)}"
            db_file = ProcessedFileESI(
                user_id=current_user.id,
                filename="N/A",
                filepath=folder_path,
                status="error",
                message=error_message,
            )
            db.add(db_file)
            db.commit()
            raise HTTPException(status_code=500, detail=error_message)
    return FileProcessResult(
        file_path=folder_path,
        status=overall_status,
        message=overall_message,
    )