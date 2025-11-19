#include<iostream>
using namespace std;

void pechati_adresi_na_elementi_na_niza(int *niza, int n)
{
	for (int i = 0; i < n; i++)
		cout << &niza[i] << endl;

	system("pause");
	cout << sizeof(int);
	system("pause");
}

int pristapi_do_element(int *niza, int n)
{
	niza += n;
	cout << niza << endl;
	return *niza;
}