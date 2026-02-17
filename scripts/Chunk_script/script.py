import os
import pandas as pd


def chunk_csv(file_path, base_name, chunk_size, output_dir):
    chunk_no = 1

    for chunk in pd.read_csv(
        file_path,
        chunksize=chunk_size,
        low_memory=True
    ):
        output_file = os.path.join(
            output_dir, f"{base_name}_chunk_{chunk_no}.csv"
        )
        chunk.to_csv(output_file, index=False)
        print(f"[✔] Created: {output_file}")
        chunk_no += 1


def chunk_excel(file_path, base_name, chunk_size, output_dir):
    # Excel loads full file → limited to ~1M rows
    df = pd.read_excel(file_path)

    total_rows = len(df)
    chunk_no = 1

    for start in range(0, total_rows, chunk_size):
        end = start + chunk_size
        chunk_df = df.iloc[start:end]

        output_file = os.path.join(
            output_dir, f"{base_name}_chunk_{chunk_no}.xlsx"
        )
        chunk_df.to_excel(output_file, index=False)
        print(f"[✔] Created: {output_file}")
        chunk_no += 1


def main():
    print("\n==== FILE CHUNKING TOOL ====\n")

    input_file = input("Enter file path (CSV / Excel): ").strip()

    if not os.path.exists(input_file):
        print("❌ File not found!")
        return

    try:
        chunk_size = int(input("Enter chunk size (rows per chunk): ").strip())
    except ValueError:
        print("❌ Chunk size must be a number")
        return

    output_dir = input("Enter output directory (default: chunks): ").strip()
    if not output_dir:
        output_dir = "chunks"

    os.makedirs(output_dir, exist_ok=True)

    file_name = os.path.basename(input_file)
    base_name, ext = os.path.splitext(file_name)
    ext = ext.lower()

    print("\nProcessing file...\n")

    if ext == ".csv":
        chunk_csv(input_file, base_name, chunk_size, output_dir)

    elif ext in [".xlsx", ".xls"]:
        chunk_excel(input_file, base_name, chunk_size, output_dir)

    else:
        print("❌ Unsupported file format (only CSV / Excel allowed)")
        return

    print("\n✅ File chunking completed successfully!")


if __name__ == "__main__":
    main()