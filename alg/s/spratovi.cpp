#include <iostream>
#include <string>
using namespace std;
 
int main()
{
    int n;
    cin >> n;
 
    //najmal sprat za koj znaeme deka ako go frlime topcheto kje se skrshi
    int najmal = 1000000;
 
    //najgolem sprat za koj znaeme deka ako go frlime topcheto nema da se skrshi
    int najgolem = 0;
 
    for (int i=0; i<n; i++)
    {
        int sprat;
        string result;
        cin >> sprat >> result;
 
        if (result == "DA")
        {
            if (sprat < najmal)
                najmal = sprat;
        }
        else
        {
            if (sprat > najgolem)
                najgolem = sprat;
        }
    }
 
    //ne znaeme za spratovite od
    //(najgolem+1) do (najmal-1)
    cout << (najgolem+1) << " " << (najmal-1) << endl;
    return 0;
}